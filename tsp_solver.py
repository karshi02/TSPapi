import numpy as np
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import math
from typing import List, Dict, Tuple
import json

class TSPSolver:
    def __init__(self):
        self.locations = []
        self.distance_matrix = []
        
    def haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate the great circle distance between two points in kilometers"""
        R = 6371  # Earth's radius in kilometers
        
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
    
    def create_distance_matrix(self, locations: List[Dict]) -> List[List[float]]:
        """Create distance matrix from locations"""
        n = len(locations)
        matrix = [[0.0] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                if i != j:
                    matrix[i][j] = self.haversine_distance(
                        locations[i]['lat'], locations[i]['lng'],
                        locations[j]['lat'], locations[j]['lng']
                    )
                else:
                    matrix[i][j] = 0.0
                    
        return matrix
    
    def solve_tsp(self, locations: List[Dict]) -> Dict:
        """Solve TSP and return optimal route"""
        if len(locations) < 2:
            return {
                'route': [0],
                'total_distance': 0,
                'waypoints': locations
            }
        
        # Create distance matrix
        self.distance_matrix = self.create_distance_matrix(locations)
        
        # Create routing model
        manager = pywrapcp.RoutingIndexManager(len(locations), 1, 0)
        routing = pywrapcp.RoutingModel(manager)
        
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int(self.distance_matrix[from_node][to_node] * 1000)  # Convert to meters
        
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        # Set search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH)
        search_parameters.time_limit.seconds = 5
        
        # Solve
        solution = routing.SolveWithParameters(search_parameters)
        
        if solution:
            # Get route
            index = routing.Start(0)
            route = []
            total_distance = 0
            
            while not routing.IsEnd(index):
                route.append(manager.IndexToNode(index))
                previous_index = index
                index = solution.Value(routing.NextVar(index))
                if not routing.IsEnd(index):
                    total_distance += self.distance_matrix[manager.IndexToNode(previous_index)][manager.IndexToNode(index)]
            
            # Add return to start if needed
            if len(locations) > 1:
                total_distance += self.distance_matrix[route[-1]][route[0]]
                route.append(0)
            
            # Calculate estimated time (assuming 30 km/h average speed)
            estimated_time = (total_distance / 30) * 60  # in minutes
            
            # Get waypoints in order
            waypoints = [locations[i] for i in route]
            
            return {
                'route': route,
                'total_distance': round(total_distance, 2),
                'estimated_time': round(estimated_time, 1),
                'waypoints': waypoints,
                'distance_matrix': self.distance_matrix
            }
        else:
            # Fallback to nearest neighbor if OR-Tools fails
            return self.nearest_neighbor_tsp(locations)
    
    def nearest_neighbor_tsp(self, locations: List[Dict]) -> Dict:
        """Simple nearest neighbor TSP solver as fallback"""
        n = len(locations)
        if n <= 1:
            return {'route': [0], 'total_distance': 0, 'waypoints': locations}
        
        unvisited = set(range(1, n))
        route = [0]
        current = 0
        total_distance = 0
        
        while unvisited:
            next_node = min(unvisited, key=lambda x: self.haversine_distance(
                locations[current]['lat'], locations[current]['lng'],
                locations[x]['lat'], locations[x]['lng']
            ))
            total_distance += self.haversine_distance(
                locations[current]['lat'], locations[current]['lng'],
                locations[next_node]['lat'], locations[next_node]['lng']
            )
            route.append(next_node)
            unvisited.remove(next_node)
            current = next_node
        
        # Return to start
        total_distance += self.haversine_distance(
            locations[current]['lat'], locations[current]['lng'],
            locations[0]['lat'], locations[0]['lng']
        )
        route.append(0)
        
        # Get waypoints in order
        waypoints = [locations[i] for i in route]
        
        return {
            'route': route,
            'total_distance': round(total_distance, 2),
            'estimated_time': round((total_distance / 30) * 60, 1),
            'waypoints': waypoints
        }

# Global solver instance
solver = TSPSolver()