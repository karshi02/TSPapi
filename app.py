# from flask import Flask, request, jsonify, render_template
# from flask_cors import CORS
# import json
# from tsp_solver import solver
# import requests
# from datetime import datetime

# app = Flask(__name__)
# CORS(app)  # Enable CORS for all routes


from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import json
from tsp_solver import solver
import requests
from datetime import datetime

app = Flask(__name__, 
            static_folder='static',  # Serve static files from 'static' folder
            static_url_path='/static')  # URL path for static files
CORS(app)

# ... rest of your app.py code ...

# Store latest data from ESP32
latest_bin_data = []
last_update = None

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('index.html')

@app.route('/api/update', methods=['POST'])
def update_bin_data():
    """Receive data from ESP32"""
    global latest_bin_data, last_update
    
    try:
        data = request.json
        if data:
            # Add timestamp
            data['timestamp'] = datetime.now().isoformat()
            
            # Update or add bin data
            bin_id = data.get('id')
            found = False
            for i, bin_data in enumerate(latest_bin_data):
                if bin_data.get('id') == bin_id:
                    latest_bin_data[i] = data
                    found = True
                    break
            
            if not found:
                latest_bin_data.append(data)
            
            last_update = datetime.now()
            
            return jsonify({
                'status': 'success',
                'message': f'Data received for bin {bin_id}',
                'timestamp': last_update.isoformat()
            })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    
    return jsonify({'status': 'error', 'message': 'No data provided'}), 400

@app.route('/api/esp32/update', methods=['GET'])
def esp32_update_endpoint():
    """Simple GET endpoint for ESP32 to update data"""
    bin_id = request.args.get('id')
    percent = request.args.get('percent')
    lat = request.args.get('lat')
    lng = request.args.get('lng')
    location = request.args.get('location', f'Bin {bin_id}')
    
    if bin_id and percent and lat and lng:
        data = {
            'id': int(bin_id),
            'percent': int(percent),
            'lat': float(lat),
            'lng': float(lng),
            'location': location,
            'timestamp': datetime.now().isoformat()
        }
        
        # Update data
        global latest_bin_data, last_update
        found = False
        for i, bin_data in enumerate(latest_bin_data):
            if bin_data.get('id') == int(bin_id):
                latest_bin_data[i] = data
                found = True
                break
        
        if not found:
            latest_bin_data.append(data)
        
        last_update = datetime.now()
        
        return jsonify({
            'status': 'success',
            'message': f'ESP32 data received for bin {bin_id}'
        })
    
    return jsonify({'status': 'error', 'message': 'Missing parameters'}), 400

@app.route('/api/calculate-route', methods=['POST'])
def calculate_route():
    """Calculate optimal route using TSP"""
    try:
        data = request.json
        locations = data.get('locations', [])
        
        if not locations:
            # Use latest bin data if no locations provided
            if latest_bin_data:
                # Filter bins with >= 80% full
                full_bins = [bin_data for bin_data in latest_bin_data if bin_data.get('percent', 0) >= 80]
                
                if not full_bins:
                    # If no bins are full, use all bins with priority
                    locations = [
                        {
                            'id': bin_data['id'],
                            'name': bin_data['location'],
                            'lat': bin_data['lat'],
                            'lng': bin_data['lng'],
                            'percent': bin_data['percent']
                        }
                        for bin_data in latest_bin_data
                    ]
                else:
                    locations = [
                        {
                            'id': bin_data['id'],
                            'name': bin_data['location'],
                            'lat': bin_data['lat'],
                            'lng': bin_data['lng'],
                            'percent': bin_data['percent']
                        }
                        for bin_data in full_bins
                    ]
            else:
                return jsonify({'status': 'error', 'message': 'No bin data available'}), 400
        
        # Calculate optimal route
        result = solver.solve_tsp(locations)
        
        return jsonify({
            'status': 'success',
            'route': result['route'],
            'total_distance': result['total_distance'],
            'estimated_time': result['estimated_time'],
            'waypoints': result['waypoints'],
            'locations': locations
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/bins', methods=['GET'])
def get_bins():
    """Get all bin data"""
    global latest_bin_data
    return jsonify({
        'status': 'success',
        'bins': latest_bin_data,
        'count': len(latest_bin_data),
        'last_update': last_update.isoformat() if last_update else None
    })

@app.route('/api/full-bins', methods=['GET'])
def get_full_bins():
    """Get bins that are >= 80% full"""
    global latest_bin_data
    full_bins = [bin_data for bin_data in latest_bin_data if bin_data.get('percent', 0) >= 80]
    
    return jsonify({
        'status': 'success',
        'bins': full_bins,
        'count': len(full_bins)
    })

@app.route('/api/route', methods=['GET'])
def get_optimal_route():
    """Get optimal route for full bins"""
    try:
        global latest_bin_data
        full_bins = [bin_data for bin_data in latest_bin_data if bin_data.get('percent', 0) >= 80]
        
        if not full_bins:
            return jsonify({
                'status': 'success',
                'message': 'No bins are full yet',
                'route': [],
                'total_distance': 0
            })
        
        locations = [
            {
                'id': bin_data['id'],
                'name': bin_data['location'],
                'lat': bin_data['lat'],
                'lng': bin_data['lng'],
                'percent': bin_data['percent']
            }
            for bin_data in full_bins
        ]
        
        result = solver.solve_tsp(locations)
        
        return jsonify({
            'status': 'success',
            'full_bins_count': len(full_bins),
            'route': result['route'],
            'total_distance': result['total_distance'],
            'estimated_time': result['estimated_time'],
            'waypoints': result['waypoints']
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/clear', methods=['POST'])
def clear_data():
    """Clear all bin data"""
    global latest_bin_data, last_update
    latest_bin_data = []
    last_update = None
    return jsonify({'status': 'success', 'message': 'All data cleared'})

if __name__ == '__main__':
    print("=" * 50)
    print("TSP Route Optimizer API")
    print("=" * 50)
    print("Starting Flask server...")
    print("📍 Dashboard: http://localhost:5000")
    print("📡 API Endpoints:")
    print("   POST /api/update - Update bin data")
    print("   GET /api/bins - Get all bins")
    print("   GET /api/full-bins - Get full bins (≥80%)")
    print("   GET /api/route - Get optimal route")
    print("   POST /api/calculate-route - Calculate custom route")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=True)