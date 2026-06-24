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
            time.sleep(2)  # невелика пауза перед повтором
    return None

# Завантажуємо Excel
df = pd.read_excel("organizations.xlsx")

# Приводимо назви колонок до нижнього регістру без пробілів
df.columns = df.columns.str.strip().str.lower()

# Автоматично додаємо нові колонки, якщо їх немає
for col in ["lat", "lon", "place_id", "formatted_address"]:
    if col not in df.columns:
        df[col] = None

API_KEY = "AIzaSyCaSZToY3P6T2BWVfPS0wXbcw3hJgHh2tA"

cache = {}

total_rows = len(df)

for i, row in df.iterrows():
    # Пропускаємо рядки, де координати вже є
    if pd.notna(row["lat"]) and pd.notna(row["lon"]):
        continue

    address = row["адреса"]

    if address in cache:
        lat, lon, place_id, formatted_address = cache[address]
    else:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": address, "key": API_KEY}
        response = requests.get(url, params=params).json()

        if response["status"] == "OK":
            result = response["results"][0]
            location = result["geometry"]["location"]
            lat, lon = location["lat"], location["lng"]
            place_id = result.get("place_id")
            formatted_address = result.get("formatted_address")
            cache[address] = (lat, lon, place_id, formatted_address)
        else:
            lat, lon, place_id, formatted_address = None, None, None, None
            with open("geocode_errors.log", "a", encoding="utf-8") as log_file:
                log_file.write(f"Не вдалося знайти координати для: {address}\n")

        time.sleep(0.3)

    # Записуємо дані у таблицю
    df.at[i, "lat"] = lat
    df.at[i, "lon"] = lon
    df.at[i, "place_id"] = place_id
    df.at[i, "formatted_address"] = formatted_address

    # Прогрес у відсотках
    progress = round(((i+1)/total_rows)*100, 2)
    print(f"Оброблено {i+1}/{total_rows} рядків ({progress}%)")

    # Чекпоінт кожні 100 рядків
    if (i + 1) % 50 == 0:
        checkpoint_file = f"organizations_checkpoint_{i+1}.xlsx"
        df.to_excel(checkpoint_file, index=False)
        print(f"Збережено чекпоінт: {checkpoint_file}")

# Фінальне збереження
df.to_excel("organizations_with_coords.xlsx", index=False)
print("Готово! Результат збережено у organizations_with_coords.xlsx")
