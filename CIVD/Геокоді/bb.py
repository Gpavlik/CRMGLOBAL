import pandas as pd
import requests
import time

def safe_request(url, params, retries=3):
    for attempt in range(retries):
        try:
            response = requests.get(url, params=params, timeout=10)
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Помилка: {e}, спроба {attempt+1}/{retries}")
            time.sleep(2)
    return None

# Завантажуємо Excel
df = pd.read_excel("organizations.xlsx")
df.columns = df.columns.str.strip().str.lower()

# Додаємо додаткові колонки, якщо їх немає
for col in ["place_id", "formatted_address"]:
    if col not in df.columns:
        df[col] = None

API_KEY = "AIzaSyCaSZToY3P6T2BWVfPS0wXbcw3hJgHh2tA"

cache_address = {}
cache_coords = {}

total_rows = len(df)

for i, row in df.iterrows():
    lat, lon = row.get("lat"), row.get("lng")
    address = row.get("address")
    city = row.get("city")
    region = row.get("region")

    # 1. Якщо є координати, але немає адреси
    if pd.notna(lat) and pd.notna(lon) and (pd.isna(address) or address == ""):
        coords_key = f"{lat},{lon}"
        if coords_key in cache_coords:
            formatted_address, street, house, place_id = cache_coords[coords_key]
        else:
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {"latlng": coords_key, "key": API_KEY}
            response = safe_request(url, params)
            if response and response["status"] == "OK":
                result = response["results"][0]
                formatted_address = result.get("formatted_address")
                place_id = result.get("place_id")

                # Витягуємо вулицю та номер будинку
                components = result["address_components"]
                street = next((c["long_name"] for c in components if "route" in c["types"]), "")
                house = next((c["long_name"] for c in components if "street_number" in c["types"]), "")
                address = f"{street} {house}".strip()

                cache_coords[coords_key] = (formatted_address, street, house, place_id)
            else:
                formatted_address, street, house, place_id = None, None, None, None

        df.at[i, "address"] = address
        df.at[i, "formatted_address"] = formatted_address
        df.at[i, "place_id"] = place_id

    # 2. Якщо є адреса (місто + область + вулиця), але немає координат
    elif (pd.isna(lat) or pd.isna(lon)) and pd.notna(address):
        full_address = f"{city}, {region}, {address}, Україна"
        if full_address in cache_address:
            lat, lon, place_id, formatted_address = cache_address[full_address]
        else:
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {"address": full_address, "key": API_KEY}
            response = safe_request(url, params)
            if response and response["status"] == "OK":
                result = response["results"][0]
                location = result["geometry"]["location"]
                lat, lon = location["lat"], location["lng"]
                place_id = result.get("place_id")
                formatted_address = result.get("formatted_address")
                cache_address[full_address] = (lat, lon, place_id, formatted_address)
            else:
                lat, lon, place_id, formatted_address = None, None, None, None

        df.at[i, "lat"] = lat
        df.at[i, "lng"] = lon
        df.at[i, "place_id"] = place_id
        df.at[i, "formatted_address"] = formatted_address

    # Прогрес
    progress = round(((i+1)/total_rows)*100, 2)
    print(f"Оброблено {i+1}/{total_rows} рядків ({progress}%)")

    # Чекпоінт кожні 100 рядків
    if (i + 1) % 100 == 0:
        checkpoint_file = f"organizations_checkpoint_{i+1}.xlsx"
        df.to_excel(checkpoint_file, index=False)
        print(f"Збережено чекпоінт: {checkpoint_file}")

# Фінальне збереження
df.to_excel("organizations_enriched.xlsx", index=False)
print("Готово! Результат збережено у organizations_enriched.xlsx")
