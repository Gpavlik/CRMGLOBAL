import pandas as pd
from transliterate import translit

# Завантажуємо Excel
df = pd.read_excel("organizations_enriched.xlsx")
df.columns = df.columns.str.strip().str.lower()

# Словник для заміни ключових слів
replace_map = {
    "Street": "Вулиця",
    "Avenue": "Проспект",
    "Lane": "Провулок",
    "Line": "Лінія",
    "District": "Район",
    "Quarter": "Квартал",
    "Ploshcha": "Площа",
    "Prospekt": "Проспект",
    "Akademika": "Академіка"
}

def translit_to_uk(text):
    if pd.isna(text):
        return text
    try:
        # Спочатку транслітерація літер
        text = translit(text, 'uk', reversed=True)
        # Потім заміна ключових слів
        for latin, ukr in replace_map.items():
            text = text.replace(latin, ukr)
        return text
    except Exception:
        return text

# Перекладаємо тільки колонку address
df["address"] = df["address"].apply(translit_to_uk)

# Зберігаємо результат
df.to_excel("organizations_address_transliterated.xlsx", index=False)
print("Готово! Колонка 'address' переведена у кирилицю та збережена у organizations_address_transliterated.xlsx")
