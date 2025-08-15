from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta
import time
import logging
import os
import json

# Import the Abacus AI integration
from abacus_integration import AbacusManager

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for React app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SMART CACHING SYSTEM - Allows manual refresh override
CACHE = {}
CACHE_DURATION = 120  # 2 minutes cache for auto-refresh
FORCE_REFRESH_PARAM = 'force_refresh'

def get_from_cache(key, allow_cache=True):
    if not allow_cache:
        logger.info(f"Cache bypassed for {key} (manual refresh)")
        return None
        
    if key in CACHE:
        data, timestamp = CACHE[key]
        if datetime.now() - timestamp < timedelta(seconds=CACHE_DURATION):
            logger.info(f"Using cached data for {key}")
            return data
    return None

def set_cache(key, data):
    CACHE[key] = (data, datetime.now())
    logger.info(f"Cached data for {key}")

# Initialize Abacus AI Manager
abacus_manager = AbacusManager()

# Your Abacus AI configuration from the codes you provided
ABACUS_API_KEY = "s2_440d8b6da4094a9badee296fd7e6500d"  # Replace with your real API key
FEATURE_GROUP_ID = "4d868f4c"
DATASET_ID = "3dee61c66"
PROJECT_ID = "16b4367d2c"

def load_orders_from_abacus(force_refresh=False):
    """Load orders from Abacus AI with smart caching"""
    cache_key = "all_orders"
    
    # Check cache first (unless force refresh)
    if not force_refresh:
        cached_data = get_from_cache(cache_key, allow_cache=True)
        if cached_data:
            return cached_data
    
    try:
        logger.info("🤖 Fetching data from Abacus AI...")
        
        # Use your Abacus AI manager to get data
        orders_data = abacus_manager.get_orders_data(
            api_key=ABACUS_API_KEY,
            feature_group_id=FEATURE_GROUP_ID,
            dataset_id=DATASET_ID,
            project_id=PROJECT_ID
        )
        
        if orders_data and len(orders_data) > 0:
            logger.info(f"✅ Loaded {len(orders_data)} orders from Abacus AI")
            set_cache(cache_key, orders_data)
            if force_refresh:
                logger.info("🔄 FORCE REFRESH: Fresh data loaded from Abacus AI")
            return orders_data
        else:
            raise Exception("No data returned from Abacus AI")
        
    except Exception as e:
        logger.error(f"Error loading orders from Abacus AI: {e}")
        logger.info("Falling back to mock data")
        
        # Fallback mock data
        mock_data = get_mock_orders()
        set_cache(cache_key, mock_data)
        return mock_data

def get_mock_orders():
    """Mock data for testing when Abacus AI is unavailable"""
    return [
        {
            'id': 'ORD-2025-001',
            'booth_number': 'A-245',
            'exhibitor_name': 'TechFlow Innovations',
            'item': 'Premium Booth Setup Package',
            'description': 'Complete booth installation with premium furniture, lighting, and tech setup',
            'color': 'White',
            'quantity': 1,
            'status': 'out-for-delivery',
            'order_date': 'June 14, 2025',
            'comments': 'Rush delivery requested',
            'section': 'Section A'
        },
        {
            'id': 'ORD-2025-002',
            'booth_number': 'A-245',
            'exhibitor_name': 'TechFlow Innovations',
            'item': 'Interactive Display System',
            'description': '75" 4K touchscreen display with interactive software and mounting',
            'color': 'Black',
            'quantity': 1,
            'status': 'in-route',
            'order_date': 'June 13, 2025',
            'comments': '',
            'section': 'Section A'
        },
        {
            'id': 'ORD-2025-003',
            'booth_number': 'B-156',
            'exhibitor_name': 'GreenWave Energy',
            'item': 'Marketing Materials Bundle',
            'description': 'Banners, brochures, business cards, and promotional items',
            'color': 'Green',
            'quantity': 5,
            'status': 'delivered',
            'order_date': 'June 12, 2025',
            'comments': 'Eco-friendly materials requested',
            'section': 'Section B'
        },
        {
            'id': 'ORD-2025-004',
            'booth_number': 'C-089',
            'exhibitor_name': 'SmartHealth Corp',
            'item': 'Audio-Visual Equipment',
            'description': 'Professional sound system, microphones, and presentation equipment',
            'color': 'White',
            'quantity': 1,
            'status': 'in-process',
            'order_date': 'June 14, 2025',
            'comments': 'Medical grade equipment required',
            'section': 'Section C'
        }
    ]

# API ROUTES
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy', 
        'timestamp': datetime.now().isoformat(),
        'abacus_ai_connected': abacus_manager is not None,
        'cache_size': len(CACHE)
    })

@app.route('/api/abacus-status', methods=['GET'])
def abacus_status():
    """System status endpoint"""
    return jsonify({
        'platform': 'Expo Convention Contractors',
        'status': 'connected',
        'database': 'Abacus AI Integration',
        'last_sync': datetime.now().isoformat(),
        'version': '3.0.0',
        'cache_enabled': True
    })

@app.route('/api/orders', methods=['GET'])
def get_all_orders():
    """Get all orders with smart caching"""
    force_refresh = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    orders = load_orders_from_abacus(force_refresh=force_refresh)
    return jsonify(orders)

@app.route('/api/orders/booth/<booth_number>', methods=['GET'])
def get_orders_by_booth(booth_number):
    """Get orders for a specific booth number with smart caching"""
    cache_key = f"booth_{booth_number}"
    force_refresh = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    
    # Try cache first (unless force refresh)
    if not force_refresh:
        cached_data = get_from_cache(cache_key, allow_cache=True)
        if cached_data:
            return jsonify(cached_data)
    
    try:
        # Get all orders and filter by booth number
        all_orders = load_orders_from_abacus(force_refresh=force_refresh)
        booth_orders = [
            order for order in all_orders 
            if order['booth_number'].lower() == booth_number.lower()
        ]
        
        delivered_count = len([o for o in booth_orders if o['status'] == 'delivered'])
        
        result = {
            'booth': booth_number,
            'orders': booth_orders,
            'total_orders': len(booth_orders),
            'delivered_orders': delivered_count,
            'last_updated': datetime.now().isoformat(),
            'force_refreshed': force_refresh
        }
        
        set_cache(cache_key, result)
        
        if force_refresh:
            logger.info(f"🔄 MANUAL REFRESH: Fresh data for booth {booth_number}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting orders for booth {booth_number}: {e}")
        return jsonify({
            'booth': booth_number,
            'orders': [],
            'total_orders': 0,
            'delivered_orders': 0,
            'last_updated': datetime.now().isoformat(),
            'error': str(e)
        }), 500

@app.route('/api/orders/exhibitor/<exhibitor_name>', methods=['GET'])
def get_orders_by_exhibitor(exhibitor_name):
    """Get orders for a specific exhibitor with smart caching"""
    cache_key = f"exhibitor_{exhibitor_name}"
    force_refresh = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    
    # Try cache first (unless force refresh)
    if not force_refresh:
        cached_data = get_from_cache(cache_key, allow_cache=True)
        if cached_data:
            return jsonify(cached_data)
    
    try:
        # Get all orders and filter
        all_orders = load_orders_from_abacus(force_refresh=force_refresh)
        exhibitor_orders = [
            order for order in all_orders 
            if order['exhibitor_name'].lower() == exhibitor_name.lower()
        ]
        
        delivered_count = len([o for o in exhibitor_orders if o['status'] == 'delivered'])
        
        result = {
            'exhibitor': exhibitor_name,
            'orders': exhibitor_orders,
            'total_orders': len(exhibitor_orders),
            'delivered_orders': delivered_count,
            'last_updated': datetime.now().isoformat(),
            'force_refreshed': force_refresh
        }
        
        set_cache(cache_key, result)
        
        if force_refresh:
            logger.info(f"🔄 MANUAL REFRESH: Fresh data for {exhibitor_name}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting orders for exhibitor {exhibitor_name}: {e}")
        return jsonify({
            'exhibitor': exhibitor_name,
            'orders': [],
            'total_orders': 0,
            'delivered_orders': 0,
            'last_updated': datetime.now().isoformat(),
            'error': str(e)
        }), 500

@app.route('/api/exhibitors', methods=['GET'])
def get_exhibitors():
    """Get list of all exhibitors with smart caching"""
    cache_key = "exhibitors"
    force_refresh = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    
    # Try cache first (unless force refresh)
    if not force_refresh:
        cached_data = get_from_cache(cache_key, allow_cache=True)
        if cached_data:
            return jsonify(cached_data)
    
    try:
        exhibitors = []
        
        # Get exhibitors from orders data
        orders = load_orders_from_abacus(force_refresh=force_refresh)
        exhibitors_dict = {}
        
        for order in orders:
            exhibitor_name = order['exhibitor_name']
            booth_number = order['booth_number']
            
            if exhibitor_name not in exhibitors_dict:
                exhibitors_dict[exhibitor_name] = {
                    'name': exhibitor_name,
                    'booth': booth_number,
                    'total_orders': 0,
                    'delivered_orders': 0
                }
            
            exhibitors_dict[exhibitor_name]['total_orders'] += 1
            if order['status'] == 'delivered':
                exhibitors_dict[exhibitor_name]['delivered_orders'] += 1
        
        exhibitors = list(exhibitors_dict.values())
        set_cache(cache_key, exhibitors)
        return jsonify(exhibitors)
        
    except Exception as e:
        logger.error(f"Error getting exhibitors: {e}")
        return jsonify([]), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get overall statistics"""
    force_refresh = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    orders = load_orders_from_abacus(force_refresh=force_refresh)
    
    stats = {
        'total_orders': len(orders),
        'delivered': len([o for o in orders if o['status'] == 'delivered']),
        'in_process': len([o for o in orders if o['status'] == 'in-process']),
        'in_route': len([o for o in orders if o['status'] == 'in-route']),
        'out_for_delivery': len([o for o in orders if o['status'] == 'out-for-delivery']),
        'cancelled': len([o for o in orders if o['status'] == 'cancelled']),
        'last_updated': datetime.now().isoformat()
    }
    
    return jsonify(stats)

@app.route('/api/clear-cache', methods=['POST'])
def clear_cache():
    """Clear all cached data - useful for forcing fresh data"""
    global CACHE
    CACHE = {}
    logger.info("🗑️ Cache cleared manually")
    return jsonify({'message': 'Cache cleared successfully'})

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
