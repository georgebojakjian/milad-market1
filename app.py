import os
import sqlite3
import requests
import base64
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.utils import secure_filename
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'milad_market_secret_2026'

# ===== IMGBB CONFIGURATION =====
# PASTE YOUR IMGBB API KEY HERE (from imgbb.com dashboard)
IMGBB_API_KEY = "YOUR_IMGBB_API_KEY_HERE"

def upload_to_imgbb(image_data, filename):
    """Upload an image to ImgBB and return the direct URL"""
    try:
        # Encode image to base64
        encoded = base64.b64encode(image_data).decode('utf-8')
        
        # Send to ImgBB API
        url = "https://api.imgbb.com/1/upload"
        payload = {
            "key": IMGBB_API_KEY,
            "image": encoded,
            "name": filename
        }
        response = requests.post(url, data=payload)
        result = response.json()
        
        if result.get('success'):
            return result['data']['url']
        else:
            print(f"ImgBB upload error: {result}")
            return None
    except Exception as e:
        print(f"ImgBB upload exception: {e}")
        return None

# ===== DATABASE =====
def get_db():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_ar TEXT NOT NULL,
            name_en TEXT,
            price_usd REAL NOT NULL,
            category TEXT,
            image TEXT,
            is_in_stock BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        
        conn.execute('''CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT
        )''')
        
        conn.execute('''CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT,
            product_ids TEXT,
            total_price REAL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        
        defaults = {
            'store_name': 'سوق ميلاد الصغير - Milad Mini Market',
            'store_address': 'VVPQ+XHQ, Tartus, Syria',
            'store_phone': '+963 123 456 789',
            'whatsapp_number': '963123456789',
            'working_hours': '٨ صباحاً - ١١ مساءً (8 AM - 11 PM)',
            'usd_to_syp': '15000',
            'admin_password': 'milad2026'
        }
        for key, val in defaults.items():
            conn.execute(
                'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
                (key, val)
            )
        conn.commit()

init_db()

def get_setting(key):
    with get_db() as conn:
        row = conn.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
        return row['value'] if row else None

# ===== ROUTES =====
@app.route('/')
def index():
    with get_db() as conn:
        products = conn.execute('SELECT * FROM products ORDER BY is_in_stock DESC, id DESC').fetchall()
        categories = conn.execute('SELECT DISTINCT category FROM products WHERE category IS NOT NULL').fetchall()
    
    exchange_rate = float(get_setting('usd_to_syp') or 15000)
    store_info = {
        'name': get_setting('store_name'),
        'address': get_setting('store_address'),
        'phone': get_setting('store_phone'),
        'whatsapp': get_setting('whatsapp_number'),
        'hours': get_setting('working_hours')
    }
    return render_template('index.html', 
                           products=products, 
                           categories=[c[0] for c in categories],
                           exchange_rate=exchange_rate,
                           store=store_info)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        password = request.form.get('password')
        if password == get_setting('admin_password'):
            session['logged_in'] = True
            return redirect(url_for('dashboard'))
        return render_template('login.html', error='كلمة المرور غير صحيحة')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    with get_db() as conn:
        products = conn.execute('SELECT * FROM products ORDER BY id DESC').fetchall()
        orders = conn.execute('SELECT * FROM orders ORDER BY id DESC').fetchall()
        stats = {
            'total': conn.execute('SELECT COUNT(*) FROM products').fetchone()[0],
            'out_of_stock': conn.execute('SELECT COUNT(*) FROM products WHERE is_in_stock = 0').fetchone()[0],
            'orders': conn.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
        }
        exchange_rate = float(get_setting('usd_to_syp') or 15000)
        store_info = {
            'store_name': get_setting('store_name'),
            'store_address': get_setting('store_address'),
            'store_phone': get_setting('store_phone'),
            'whatsapp_number': get_setting('whatsapp_number'),
            'working_hours': get_setting('working_hours')
        }
    return render_template('dashboard.html',
                           products=products,
                           orders=orders,
                           stats=stats,
                           exchange_rate=exchange_rate,
                           store=store_info)

# ===== API ENDPOINTS =====
@app.route('/api/toggle/<int:pid>', methods=['POST'])
def toggle_stock(pid):
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    with get_db() as conn:
        current = conn.execute('SELECT is_in_stock FROM products WHERE id = ?', (pid,)).fetchone()
        if current:
            new_status = 0 if current['is_in_stock'] else 1
            conn.execute('UPDATE products SET is_in_stock = ? WHERE id = ?', (new_status, pid))
            conn.commit()
            return jsonify({'success': True, 'new_status': new_status})
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/product', methods=['POST'])
def add_product():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    name_ar = request.form.get('name_ar')
    name_en = request.form.get('name_en')
    price_usd = float(request.form.get('price_usd') or 0)
    category = request.form.get('category')
    is_in_stock = 1 if request.form.get('is_in_stock') == 'on' else 0
    
    image_url = None
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            image_data = file.read()
            # Upload to ImgBB
            image_url = upload_to_imgbb(image_data, filename)
    
    with get_db() as conn:
        conn.execute('''INSERT INTO products (name_ar, name_en, price_usd, category, image, is_in_stock)
                        VALUES (?, ?, ?, ?, ?, ?)''',
                     (name_ar, name_en, price_usd, category, image_url, is_in_stock))
        conn.commit()
    return jsonify({'success': True})

@app.route('/api/product/<int:pid>', methods=['DELETE'])
def delete_product(pid):
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    with get_db() as conn:
        conn.execute('DELETE FROM products WHERE id = ?', (pid,))
        conn.commit()
    return jsonify({'success': True})

@app.route('/api/settings', methods=['POST'])
def update_settings():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.form
    with get_db() as conn:
        for key in ['store_name', 'store_address', 'store_phone', 'whatsapp_number', 'working_hours', 'usd_to_syp']:
            if key in data and data[key]:
                conn.execute('UPDATE settings SET value = ? WHERE key = ?', (data[key], key))
        if 'admin_password' in data and data['admin_password'].strip():
            conn.execute('UPDATE settings SET value = ? WHERE key = "admin_password"', (data['admin_password'],))
        conn.commit()
    return jsonify({'success': True})

@app.route('/api/order', methods=['POST'])
def add_order():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    customer = request.form.get('customer_name')
    items = request.form.get('product_ids')
    total = float(request.form.get('total_price') or 0)
    status = request.form.get('status', 'pending')
    
    with get_db() as conn:
        conn.execute('INSERT INTO orders (customer_name, product_ids, total_price, status) VALUES (?, ?, ?, ?)',
                     (customer, items, total, status))
        conn.commit()
    return jsonify({'success': True})

@app.route('/api/order/<int:oid>', methods=['GET'])
def get_order(oid):
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    with get_db() as conn:
        row = conn.execute('SELECT * FROM orders WHERE id = ?', (oid,)).fetchone()
        if row:
            return jsonify(dict(row))
        return jsonify({'error': 'Not found'}), 404

@app.route('/api/order/<int:oid>', methods=['PUT'])
def update_order(oid):
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json()
    with get_db() as conn:
        conn.execute('''UPDATE orders 
                        SET customer_name = ?, product_ids = ?, total_price = ?, status = ?
                        WHERE id = ?''',
                     (data.get('customer_name'), data.get('product_ids'), 
                      data.get('total_price'), data.get('status'), oid))
        conn.commit()
    return jsonify({'success': True})

@app.route('/api/order/<int:oid>', methods=['DELETE'])
def delete_order(oid):
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    with get_db() as conn:
        conn.execute('DELETE FROM orders WHERE id = ?', (oid,))
        conn.commit()
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)