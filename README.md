# Budget-Tracker-Mobile-App
iOS, Android, Web app using React Native and JS


````md
# 📊 MoneyTrack – AI Receipt Scanner & Expense Tracker

MoneyTrack is a **cross-platform expense tracking app** built with **Expo (React Native)** that lets users **scan receipts using AI (Gemini Vision)** and automatically extract transaction details like merchant name, amount, category, date, currency, and payment method.

The app works on **Android, iOS, and Web** and is fully compatible with **Expo Snack**.

---

## ✨ Features

### 🧾 AI Receipt Scanning
- Upload one or multiple receipt images
- Uses **Google Gemini Vision (gemini-2.5-flash)** for OCR + understanding
- Automatically extracts:
  - Merchant name
  - Total amount
  - Date
  - Category
  - Currency
  - Payment method (Cash / Card / UPI)

### 📂 Expense Management
- View all transactions in a clean list
- Edit transactions (amount, date, category, merchant)
- Delete transactions with confirmation
- Category-based emoji tagging

### 📆 Smart Filters
- All Time
- This Month
- Last Month
- Custom Date Range (manual input)

### 🎨 Personalization
- Light / Dark / System theme
- Multiple theme colors (Purple, Blue, Green, Teal, Orange, Pink)
- Custom categories
- Multiple currencies + custom currency support

### 🔐 Privacy-Friendly
- API key stored only locally in app state
- No backend required
- No receipt images stored on a server

---

## 🛠️ Tech Stack

- **Expo (React Native)**
- **Expo Image Picker**
- **Google Gemini Vision API**
- **React Native Paper (MD3)**
- **date-fns**
- **Expo Linear Gradient**
- **Expo Safe Area Context**

---

## 📱 Supported Platforms

| Platform | Supported |
|--------|----------|
| Android | ✅ |
| iOS | ✅ |
| Web | ✅ |
| Expo Snack | ✅ |

---

## 🚀 Running the App

### Option 1: Expo Snack (Recommended)
1. Go to **https://snack.expo.dev**
2. Paste:
   - `App.js`
   - `lib/gemini.js`
3. Add required dependencies (Snack auto-installs most)
4. Run instantly on:
   - Android device
   - iOS device
   - Web preview

### Option 2: Local Setup

```bash
npm install -g expo-cli
git clone <your-repo-url>
cd moneytrack
npm install
expo start
````

---

## 🔑 Gemini API Setup

### Step 1: Get API Key

1. Visit: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create a **Gemini API Key**

### Step 2: Add to App

* Open **Settings**
* Paste API key into **Gemini API Key** field

> 🔒 The key is never uploaded anywhere except directly to Google Gemini.

---

## 🧠 How Receipt Scanning Works

1. User selects receipt images
2. Images are converted to **Base64**
3. Sent to Gemini Vision with a **strict JSON-only prompt**
4. Response is cleaned & parsed
5. Expense is auto-created in the app

---

## 📄 Gemini Prompt Design

The app forces Gemini to return **only JSON**:

```json
{
  "merchant": "STORE NAME",
  "category": "Food",
  "date": "2024-01-01",
  "currency": "INR",
  "total_amount": 299.50,
  "payment_method": "Card"
}
```

Extra safeguards:

* Removes markdown blocks
* Extracts JSON via regex
* Handles string/number amount formats
* Falls back safely if parsing fails

---

## 🗂️ Project Structure

```
.
├── App.js
├── lib/
│   └── gemini.js
├── assets/
├── README.md
```

---


## 🧑‍💻 Author

Built by **NavyGeeks**
🌐 [https://navygeeks.in](https://navygeeks.in)

---

