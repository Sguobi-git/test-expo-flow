from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
from datetime import datetime, timedelta
import time
import logging
import os
import json

# Import the Google Sheets manager
from sheets_integration import GoogleSheetsManager

# Initialize Flask app with static folder for React build
app = Flask(__name__, static_folder='frontend/build', static_url_path='')
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

# Initialize Google Sheets Manager with environment credentials
def get_credentials():
    """Get Google credentials from environment variable or file"""
    try:
        # Try to get credentials from environment variable first
        credentials_json = os.environ.get('GOOGLE_CREDENTIALS_JSON')
        if credentials_json:
            # Parse the JSON string and create a temporary file
            credentials_dict = json.loads(credentials_json)
            
            # Create temporary credentials file
            with open('/tmp/credentials.json', 'w') as f:
                json.dump(credentials_dict, f)
            return '/tmp/credentials.json'
        else:
            # Fallback to local file (for development)
            return 'credentials.json'
    except Exception as e:
        logger.error(f"Error setting up credentials: {e}")
        return None

# Initialize Google Sheets Manager
credentials_path = get_credentials()
if credentials_path:
    gs_manager = GoogleSheetsManager(credentials_path)
else:
    gs_manager = None
    logger.warning("No valid credentials found - using mock data only")

# Your Google Sheet ID
SHEET_ID = "1zaRPHP3k-K1L0z3Bi_Wk--S1Xe2erOAAVYp78h18UUI"

# Mock data for testing (replace with actual Google Sheets call)
def get_mock_orders():
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

def load_orders_from_sheets(force_refresh=False):
    """Load orders from Google Sheets with smart caching"""
    cache_key = "all_orders"
    
    # Check cache first (unless force refresh)
    if not force_refresh:
        cached_data = get_from_cache(cache_key, allow_cache=True)
        if cached_data:
            return cached_data
    
    try:
        if not gs_manager:
            logger.warning("No Google Sheets manager available, using mock data")
            mock_data = get_mock_orders()
            set_cache(cache_key, mock_data)
            return mock_data
            
        # Get all orders from Google Sheets
        all_orders = []
        data = gs_manager.get_data(SHEET_ID, "Orders")
        
        # FIX: Handle both list and dataframe returns
        if data and len(data) > 0:
            # If it's a list (not empty), parse it
            if isinstance(data, list):
                all_orders = gs_manager.parse_orders_data(data)
                logger.info(f"Loaded {len(all_orders)} orders from Google Sheets (direct)")
            else:
                # If it has .empty attribute (pandas DataFrame)
                if hasattr(data, 'empty') and not data.empty:
                    all_orders = gs_manager.parse_orders_data(data)
                    logger.info(f"Loaded {len(all_orders)} orders from Google Sheets (dataframe)")
            
            if all_orders:
                set_cache(cache_key, all_orders)
                if force_refresh:
                    logger.info("🔄 FORCE REFRESH: Fresh data loaded from Google Sheets")
                return all_orders
        
        logger.warning("No data found in Google Sheets, using mock data")
        mock_data = get_mock_orders()
        set_cache(cache_key, mock_data)
        return mock_data
        
    except Exception as e:
        logger.error(f"Error loading orders from sheets: {e}")
        logger.info("Falling back to mock data")
        mock_data = get_mock_orders()
        set_cache(cache_key, mock_data)
        return mock_data

def map_status(sheet_status):
    """Map Google Sheets status to React app status"""
    status_mapping = {
        'Delivered': 'delivered',
        'Received': 'delivered',
        'Out for delivery': 'out-for-delivery',
        'In route from warehouse': 'in-route',
        'In Process': 'in-process',
        'cancelled': 'cancelled'
    }
    return status_mapping.get(sheet_status, 'in-process')

# REACT APP SERVING ROUTES
@app.route('/')
def serve_react_app():
    """Serve the React app"""
    try:
        return send_file('frontend/build/index.html')
    except FileNotFoundError:
        return "Frontend not built. Please run 'npm run build' in frontend directory.", 404

@app.route('/<path:path>')
def serve_static_files(path):
    """Serve static files or React app for client-side routing"""
    try:
        # Try to serve static file first
        return send_from_directory('frontend/build', path)
    except FileNotFoundError:
        # If file not found, serve React app (for client-side routing)
        try:
            return send_file('frontend/build/index.html')
        except FileNotFoundError:
            return "Frontend not built. Please run 'npm run build' in frontend directory.", 404

# API ROUTES
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy', 
        'timestamp': datetime.now().isoformat(),
        'google_sheets_connected': gs_manager is not None,
        'cache_size': len(CACHE)
    })

@app.route('/api/abacus-status', methods=['GET'])
def abacus_status():
    """System status endpoint"""
    return jsonify({
        'platform': 'Expo Convention Contractors',
        'status': 'connected',
        'database': 'Google Sheets Integration',
        'last_sync': datetime.now().isoformat(),
        'version': '3.0.0',
        'cache_enabled': True
    })

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
        orders = load_orders_from_sheets(force_refresh=force_refresh)
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

@app.route('/api/orders', methods=['GET'])
def get_all_orders():
    """Get all orders with smart caching"""
    force_refresh = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    orders = load_orders_from_sheets(force_refresh=force_refresh)
    return jsonify(orders)

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
        all_orders = load_orders_from_sheets(force_refresh=force_refresh)
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

@app.route('/api/orders/booth/<booth_number>', methods=['GET'])
def get_orders_by_booth(booth_number):
    """Get orders for a specific booth"""
    force_refresh = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    orders = load_orders_from_sheets(force_refresh=force_refresh)
    booth_orders = [order for order in orders if order['booth_number'] == booth_number]
    
    return jsonify({
        'booth': booth_number,
        'orders': booth_orders,
        'total_orders': len(booth_orders),
        'last_updated': datetime.now().isoformat()
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get overall statistics"""
    force_refresh = request.args.get(FORCE_REFRESH_PARAM, 'false').lower() == 'true'
    orders = load_orders_from_sheets(force_refresh=force_refresh)
    
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
