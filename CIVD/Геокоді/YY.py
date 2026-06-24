import requests
from bs4 import BeautifulSoup
import pandas as pd
import json
import time

BASE_URL = "https://doc.ua/ua/kliniki"

def scrape_city(city, max_pages=111, delay=7, retries=5, empty_threshold=2):
    clinics = []
    empty_pages_in_row = 0

    for page in range(1, max_pages + 1):
        url = f"{BASE_URL}/{city}/all" if page == 1 else f"{BASE_URL}/{city}/all/page-{page}"
        print(f"🔎 {city.title()} — сторінка {page}")

        cards = []
        for attempt in range(retries):
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                cards = soup.select("div.clinic-card__content")
                if cards:  # якщо знайшли клініки — виходимо зі спроб
                    break
            time.sleep(delay)

        print(f"➡️ Знайдено {len(cards)} клінік на сторінці {page}")

        if not cards:
            empty_pages_in_row += 1
            if empty_pages_in_row >= empty_threshold:
                print("⛔ Дві сторінки поспіль порожні — завершуємо парсинг.")
                break
        else:
            empty_pages_in_row = 0  # скидаємо лічильник

        for card in cards:
            name_tag = card.select_one("h3.clinic-card__title a")
            name = name_tag.get_text(strip=True) if name_tag else None
            link = name_tag["href"] if name_tag else None

            address_tag = card.select_one("div.address span.address__name")
            address = address_tag.get_text(strip=True) if address_tag else None

            specs = [s.get_text(strip=True) for s in card.select("a.clinic-card__service-link")]

            clinics.append({
                "city": city,
                "name": name,
                "address": address,
                "specializations": ", ".join(specs),
                "link": link
            })
    return clinics

if __name__ == "__main__":
    data = scrape_city("chernigov", max_pages=111, delay=7, retries=3, empty_threshold=1)
    with open("chernigov_clinics.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    df = pd.DataFrame(data)
    df.to_excel("chernigov_clinics.xlsx", index=False)
    print(f"✅ Збережено {len(data)} клінік для chernigov у chernigov_clinics.xlsx")