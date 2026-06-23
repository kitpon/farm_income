import os
import json
import requests
from flask import Flask, render_template, jsonify
from datetime import datetime

app = Flask(__name__)

# Constants
CACHE_FILE = "dashboard_data.json"
API_URLS = {
    "production_index": "https://agriapi.nabc.go.th/api/production-index-month/sector?page=1",
    "price_index": "https://agriapi.nabc.go.th/api/price-index-month/sector?page=1",
    "daily_lime": "https://agriapi.nabc.go.th/api/daily-prices/product?product_name=มะนาว ผลขนาดใหญ่พิเศษ&page=1",
    "weekly_buffalo": "https://agriapi.nabc.go.th/api/weekly-prices/commod?commod=กระบือ&page=1",
    "monthly_buffalo": "https://agriapi.nabc.go.th/api/monthly-prices/commod?commod=กระบือ&page=1",
    "weekly_pork": "https://agriapi.nabc.go.th/api/weekly-prices/commod?commod=สุกร&page=1",
    "monthly_pork": "https://agriapi.nabc.go.th/api/monthly-prices/commod?commod=สุกร&page=1",
    "weekly_rice": "https://agriapi.nabc.go.th/api/weekly-prices/commod?commod=ข้าว&page=1",
    "weekly_rubber": "https://agriapi.nabc.go.th/api/weekly-prices/commod?commod=ยางพารา&page=1",
    "weekly_cassava": "https://agriapi.nabc.go.th/api/weekly-prices/commod?commod=มันสำปะหลัง&page=1",
    "weekly_corn": "https://agriapi.nabc.go.th/api/weekly-prices/commod?commod=ข้าวโพดเลี้ยงสัตว์&page=1",
    "weekly_oilpalm": "https://agriapi.nabc.go.th/api/weekly-prices/commod?commod=ปาล์มน้ำมัน&page=1",
    "production_rice": "https://agriapi.nabc.go.th/api/production/by-commod?commod=ข้าว&api_type=1&page=1",
    "production_rubber": "https://agriapi.nabc.go.th/api/production/by-commod?commod=ยางพารา&api_type=1&page=1",
    "production_cassava": "https://agriapi.nabc.go.th/api/production/by-commod?commod=มันสำปะหลัง&api_type=1&page=1",
    "production_corn": "https://agriapi.nabc.go.th/api/production/by-commod?commod=ข้าวโพดเลี้ยงสัตว์&api_type=1&page=1",
    "production_oilpalm": "https://agriapi.nabc.go.th/api/production/by-commod?commod=ปาล์มน้ำมัน&api_type=1&page=1",
}

def fetch_external_data():
    """Fetch data from all external APIs and compile into a single dict."""
    compiled_data = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": "success",
        "data": {}
    }
    
    # Try to load existing cache first to reuse if some endpoints fail
    existing_cache = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                existing_cache = json.load(f).get("data", {})
        except Exception:
            pass

    for key, url in API_URLS.items():
        print(f"Fetching {key}...")
        try:
            response = requests.get(url, timeout=15)
            if response.status_code == 200:
                json_data = response.json()
                if json_data.get("success"):
                    compiled_data["data"][key] = json_data.get("data", [])
                else:
                    print(f"API returned success=false for {key}. Using cache if available.")
                    compiled_data["data"][key] = existing_cache.get(key, [])
            else:
                print(f"HTTP {response.status_code} for {key}. Using cache if available.")
                compiled_data["data"][key] = existing_cache.get(key, [])
        except Exception as e:
            print(f"Error fetching {key}: {e}. Using cache if available.")
            compiled_data["data"][key] = existing_cache.get(key, [])
            
    # Post-process and calculate Farm Income Index
    calculate_farm_income(compiled_data)
    
    # Save to file
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(compiled_data, f, indent=2, ensure_ascii=False)
        
    return compiled_data

def calculate_farm_income(compiled_data):
    """
    Calculate Farm Income Index = (Production Index * Price Index) / 100
    Matches them by year_th and month.
    """
    prod_data = compiled_data["data"].get("production_index", [])
    price_data = compiled_data["data"].get("price_index", [])
    
    # Create lookup for prices by (year_th, month)
    price_lookup = {}
    for item in price_data:
        year = item.get("year_th")
        month = item.get("month")
        if year and month:
            price_lookup[(year, month)] = item.get("price_index")
            
    farm_income_data = []
    for prod_item in prod_data:
        year = prod_item.get("year_th")
        month = prod_item.get("month")
        prod_val = prod_item.get("production_index")
        
        if year and month and prod_val is not None:
            price_val = price_lookup.get((year, month))
            if price_val is not None:
                income_val = (prod_val * price_val) / 100.0
                farm_income_data.append({
                    "year_th": year,
                    "month": month,
                    "product_sector": prod_item.get("product_sector"),
                    "product_category": prod_item.get("product_category"),
                    "product_group": prod_item.get("product_group"),
                    "commod": prod_item.get("commod"),
                    "product_name": prod_item.get("product_name"),
                    "farm_income_index": income_val,
                    "production_index": prod_val,
                    "price_index": price_val,
                    "data_date": prod_item.get("data_date")
                })
                
    compiled_data["data"]["farm_income_index"] = farm_income_data

def get_cached_data():
    """Load cached data or fetch if cache doesn't exist."""
    if not os.path.exists(CACHE_FILE):
        return fetch_external_data()
    
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading cache: {e}. Fetching new data.")
        return fetch_external_data()

# Web Routes
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/dashboard-data")
def api_dashboard_data():
    data = get_cached_data()
    return jsonify(data)

@app.route("/api/refresh")
def api_refresh():
    try:
        data = fetch_external_data()
        return jsonify(data)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    # Pre-fetch data on start
    print("Initializing agricultural dashboard data...")
    get_cached_data()
    app.run(debug=True, port=5000)
