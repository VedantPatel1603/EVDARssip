from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import csv, os
from datetime import datetime, timedelta

app = Flask(__name__, static_folder="../evdarfrontend")
CORS(app)

USERS_FILE = "users.csv"

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/dashboard.html")
def dashboard():
    return send_from_directory(app.static_folder, "dashboard.html")

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    with open(USERS_FILE) as f:
        for row in csv.DictReader(f):
            if row["username"] == data["username"] and row["password"] == data["password"]:
                return jsonify({
                    "username": row["username"],
                    "user_id": row["user_id"],
                    "role": row["role"],
                    "car": row["car"]
                })
    return jsonify({"error": "Invalid credentials"}), 401



# User-specific route (must come BEFORE general /users routes)
@app.route('/users/<user_id>')
def get_user(user_id):
    """Get a specific user by user_id from users.csv.
    Returns user data if found, otherwise 404.
    """
    print(f"[DEBUG] GET /users/{user_id} - Looking for user ID: {user_id}")
    
    if not os.path.exists(USERS_FILE):
        print(f"[ERROR] {USERS_FILE} not found")
        return jsonify({'error': 'User database not found'}), 404

    # Normalize the input user_id (strip whitespace)
    user_id = str(user_id).strip()
    print(f"[DEBUG] Normalized user_id: '{user_id}'")
    
    with open(USERS_FILE, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Compare after stripping whitespace from CSV value
            csv_user_id = str(row.get('user_id', '')).strip()
            if csv_user_id == user_id:
                # Return the user data
                print(f"[SUCCESS] Found user: {row.get('username')}")
                return jsonify({
                    'user_id': row.get('user_id', ''),
                    'username': row.get('username', ''),
                    'role': row.get('role', ''),
                    'car': row.get('car', '')
                })
    
    print(f"[ERROR] User ID {user_id} not found in CSV")
    return jsonify({'error': f'User with ID {user_id} not found'}), 404


@app.route('/users')
def users():
    """Return the users.csv as JSON array (admins only should call this).
    This endpoint is intentionally simple and returns all rows from the CSV.
    """
    users = []
    if not os.path.exists(USERS_FILE):
        return jsonify([])

    with open(USERS_FILE, newline='') as f:
        for row in csv.DictReader(f):
            users.append(row)
    return jsonify(users)


@app.route('/users', methods=['POST'])
def add_user():
    """Append a new user to users.csv. Expects JSON with keys:
    username, password, role, user_id (optional), car (optional)
    This is a simple endpoint — in production require authentication.
    """
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')
    user_id = data.get('user_id')
    car = data.get('car', '')

    if not username or not password:
        return jsonify({'error': 'username and password required'}), 400

    # CAR assignment: require car; if not provided, auto-assign next available carN.csv
    DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
    if not car or str(car).strip() == '':
        # find highest existing car number from existing users and data folder
        max_car_num = 0
        for r in existing:
            c = (r.get('car') or '').strip()
            if c.startswith('car') and c.endswith('.csv'):
                try:
                    n = int(c[3:-4])
                    if n > max_car_num: max_car_num = n
                except Exception:
                    pass
        # also check data dir for files carN.csv
        if os.path.isdir(DATA_DIR):
            for fname in os.listdir(DATA_DIR):
                if fname.startswith('car') and fname.endswith('.csv'):
                    try:
                        n = int(fname[3:-4])
                        if n > max_car_num: max_car_num = n
                    except Exception:
                        pass
        car = f'car{max_car_num+1}.csv'

    # ensure car filename format
    car = str(car).strip()
    if not (car.startswith('car') and car.endswith('.csv')):
        return jsonify({'error': 'car must be like car1.csv'}), 400

    # load existing users for validation and id generation
    existing = []
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, newline='') as f:
            for row in csv.DictReader(f):
                existing.append(row)

    # validate uniqueness: username, user_id, car
    for r in existing:
        if r.get('username') == username:
            return jsonify({'error': 'username already exists'}), 400
        if user_id and r.get('user_id') == str(user_id):
            return jsonify({'error': 'user_id already exists'}), 400
        # only check car if provided and non-empty
        if car and car.strip() != '' and r.get('car') == car:
            return jsonify({'error': 'car telemetry file already assigned'}), 400

    # generate user_id if not provided
    if not user_id:
        # find max existing id
        max_id = -1
        for row in existing:
            try:
                uid = int(row.get('user_id') or -1)
                if uid > max_id:
                    max_id = uid
            except Exception:
                pass
        user_id = str(max_id + 1)

    # append to CSV
    write_header = not os.path.exists(USERS_FILE) or os.path.getsize(USERS_FILE) == 0

    # ensure file ends with a newline before appending (prevents rows joining on same line)
    need_nl = False
    if os.path.exists(USERS_FILE) and os.path.getsize(USERS_FILE) > 0:
        with open(USERS_FILE, 'rb') as rf:
            rf.seek(-1, os.SEEK_END)
            last = rf.read(1)
            if last not in (b"\n", b"\r"):
                need_nl = True

    with open(USERS_FILE, 'a', newline='') as f:
        if need_nl:
            f.write('\n')
        writer = csv.writer(f)
        if write_header:
            writer.writerow(['user_id','username','password','role','car'])
        writer.writerow([user_id, username, password, role, car])

    # ensure corresponding car file exists in data/ and create with header if missing
    DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
    if not os.path.isdir(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
    car_path = os.path.join(DATA_DIR, car)
    if not os.path.exists(car_path):
        # create file with CSV header matching existing car files
        header = 'timestamp,lat,lon,ax,ay,az,event\n'
        with open(car_path, 'w', newline='') as cf:
            cf.write(header)

    return jsonify({'ok': True, 'user_id': user_id})


@app.route('/api/car-metadata/<car_filename>')
def get_car_metadata(car_filename):
    """Get metadata about a car file (min/max time, count) to help frontend build selectors."""
    # Validate filename
    if not car_filename.endswith('.csv') or not car_filename.startswith('car'):
        return jsonify({'error': 'Invalid car filename format'}), 400
    
    DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
    car_path = os.path.join(DATA_DIR, car_filename)
    
    if not os.path.exists(car_path):
        return jsonify({'error': 'Car file not found'}), 404

    try:
        all_dates = []
        with open(car_path, 'r', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts = row.get('timestamp')
                if ts:
                    # Try parsing with multiple formats
                    dt = None
                    for fmt in ('%Y-%m-%d %H:%M:%S', '%d-%m-%Y %H:%M'):
                        try:
                            dt = datetime.strptime(ts, fmt)
                            break
                        except ValueError:
                            continue
                    
                    if dt:
                        all_dates.append(dt)
        
        if not all_dates:
            return jsonify({'error': 'No valid dates found'}), 400

        min_date = min(all_dates)
        max_date = max(all_dates)
        
        return jsonify({
            'min_timestamp': min_date.strftime('%Y-%m-%d %H:%M:%S'),
            'max_timestamp': max_date.strftime('%Y-%m-%d %H:%M:%S'),
            'total_points': len(all_dates)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) using Haversine formula.
    Returns distance in kilometers.
    """
    import math
    # different library version of math might be needed but standard python math is fine
    # convert decimal degrees to radians 
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers.
    return c * r

@app.route('/api/car-data/<car_filename>')
def get_car_data(car_filename):
    """Get GPS telemetry data from a car CSV file.
    Query param 'start_time' (optional): ISO timestamp for start of 1-hour window.
    If not provided, returns the latest hour of data.
    """
    # Validate filename format
    if not car_filename.endswith('.csv') or not car_filename.startswith('car'):
        return jsonify({'error': 'Invalid car filename format'}), 400
    
    # Build path to car file
    DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
    car_path = os.path.join(DATA_DIR, car_filename)
    
    # Check if file exists
    if not os.path.exists(car_path):
        return jsonify({'error': 'Car file not found'}), 404
    
    try:
        # Read all data from CSV
        all_data = []
        with open(car_path, 'r', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                all_data.append(row)
        
        if not all_data:
            return jsonify([])
        
        # Parse timestamps and convert to datetime objects
        valid_rows = []
        for row in all_data:
            ts = row.get('timestamp')
            if not ts:
                continue
                
            dt = None
            for fmt in ('%Y-%m-%d %H:%M:%S', '%d-%m-%Y %H:%M'):
                try:
                    dt = datetime.strptime(ts, fmt)
                    break
                except ValueError:
                    continue
            
            if dt:
                row['datetime'] = dt
                valid_rows.append(row)
        
        if not valid_rows:
            return jsonify({'error': 'No valid timestamp data found'}), 400
        
        # Sort by datetime to ensure correct order for speed calculation
        valid_rows.sort(key=lambda x: x['datetime'])
        all_data = valid_rows
        
        # Calculate speed if missing
        for i in range(len(all_data)):
            speed = all_data[i].get('speed_kmph') or all_data[i].get('speed')
            if speed is not None and str(speed).strip() != '':
                continue # Speed already exists
            
            # Logic to calculate speed
            calculated_speed = 0.0
            if i > 0:
                prev = all_data[i-1]
                curr = all_data[i]
                
                # Get coords
                try:
                    lat1 = float(prev.get('latitude') or prev.get('lat'))
                    lon1 = float(prev.get('longitude') or prev.get('lon'))
                    lat2 = float(curr.get('latitude') or curr.get('lat'))
                    lon2 = float(curr.get('longitude') or curr.get('lon'))
                    
                    time_diff = (curr['datetime'] - prev['datetime']).total_seconds()
                    
                    if time_diff > 0:
                        dist_km = haversine(lat1, lon1, lat2, lon2)
                        hours = time_diff / 3600.0
                        calculated_speed = dist_km / hours
                except Exception:
                    pass # Keep 0 if error
            
            all_data[i]['speed_kmph'] = round(calculated_speed, 1)

        
        # Get start_time parameter or use latest hour
        start_time_param = request.args.get('start_time')
        if start_time_param:
            try:
                start_time = datetime.strptime(start_time_param, '%Y-%m-%d %H:%M:%S')
            except Exception:
                # Try fallback format for input param too if needed
                try:
                    start_time = datetime.strptime(start_time_param, '%d-%m-%Y %H:%M')
                except:
                     return jsonify({'error': 'Invalid start_time format.'}), 400
        else:
            # Use the latest timestamp in the file
            latest = max(all_data, key=lambda x: x['datetime'])
            start_time = latest['datetime'] - timedelta(hours=1)
        
        # Calculate end time (1 hour after start)
        end_time = start_time + timedelta(hours=1)
        
        # Filter data for the 1-hour window
        filtered_data = [
            row for row in all_data 
            if start_time <= row['datetime'] <= end_time
        ]
        
        # Format response
        response_data = []
        for row in filtered_data:
            # Handle mixed column names (lat/latitude, lon/longitude)
            lat = row.get('latitude') or row.get('lat')
            lon = row.get('longitude') or row.get('lon')
            speed = row.get('speed_kmph') or row.get('speed') or 0
            
            if lat is not None and lon is not None:
                response_data.append({
                    'timestamp': row['datetime'].strftime('%Y-%m-%d %H:%M:%S'),
                    'latitude': float(lat),
                    'longitude': float(lon),
                    'speed_kmph': int(float(speed))
                })
        
        return jsonify(response_data)
    
    except Exception as e:
        return jsonify({'error': f'Error reading car file: {str(e)}'}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=False)
