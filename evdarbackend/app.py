from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import csv, os

app = Flask(__name__, static_folder="../evdarfrontend")
CORS(app, resources={r"/*": {"origins": "*"}}, methods=["GET", "POST", "DELETE", "OPTIONS"])

USERS_FILE = "users.csv"

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/dashboard.html")
def dashboard():
    return send_from_directory(app.static_folder, "dashboard.html")

@app.route("/data/<path:filename>")
def serve_data(filename):
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    return send_from_directory(data_dir, filename)

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


    # CAR assignment: require car; if not provided, auto-assign next available carN.csv for non-admins
    DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
    if (not car or str(car).strip() == '') and role != 'admin':
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

    # ensure car filename format (if provided)
    car = str(car).strip()
    if car and not (car.startswith('car') and car.endswith('.csv')):
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
    if car:
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


@app.route('/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user by user_id."""
    if not os.path.exists(USERS_FILE):
        return jsonify({'error': 'User database not found'}), 404

    rows = []
    found = False
    with open(USERS_FILE, newline='') as f:
        for row in csv.DictReader(f):
            if row['user_id'] == str(user_id):
                found = True
            else:
                rows.append(row)

    if not found:
        return jsonify({'error': 'User not found'}), 404

    # Rewrite CSV
    with open(USERS_FILE, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['user_id','username','password','role','car'])
        for r in rows:
            writer.writerow([r['user_id'], r['username'], r['password'], r['role'], r['car']])

    return jsonify({'ok': True, 'message': f'User {user_id} deleted'})


if __name__ == "__main__":
    app.run(port=5000, debug=False)
