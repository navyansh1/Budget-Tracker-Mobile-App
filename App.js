import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  Platform,
  StatusBar,
  useColorScheme,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  Provider as PaperProvider,
  Text,
  ActivityIndicator,
  TextInput,
  MD3LightTheme,
  MD3DarkTheme,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { analyzeReceipt } from "./lib/gemini";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { format, subDays, startOfMonth, isAfter, parseISO, isBefore } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";

const CATEGORY_EMOJIS = {
  Food: "🍔",
  Travel: "✈️",
  Bills: "📄",
  Shopping: "🛍️",
  Health: "💊",
  Entertainment: "🎬",
  Rent: "🏠",
  Others: "📦",
};

const DEFAULT_CATEGORIES = ["Food", "Travel", "Bills", "Shopping", "Health", "Entertainment", "Rent", "Others"];
const DATE_FILTERS = ["All Time", "This Month", "Last Month", "Custom"];

// Currency suggestions
const CURRENCY_SUGGESTIONS = ["JPY", "CAD", "AUD", "CHF", "CNY", "KRW", "SGD", "AED", "BRL", "MXN"];

// Theme color options
const THEMES = {
  Purple: {
    primary: "#6366F1",
    primaryDark: "#818CF8",
    gradient: ["#6366F1", "#8B5CF6"],
    gradientDark: ["#6366F1", "#4F46E5"],
    bgLight: "#F5F3FF",
    bgDark: "#1E1B4B",
    cardDark: "#2D2A5E",
    chipDark: "#3D3A6E",
  },
  Blue: {
    primary: "#3B82F6",
    primaryDark: "#60A5FA",
    gradient: ["#3B82F6", "#1D4ED8"],
    gradientDark: ["#3B82F6", "#1E40AF"],
    bgLight: "#EFF6FF",
    bgDark: "#1E293B",
    cardDark: "#334155",
    chipDark: "#475569",
  },
  Green: {
    primary: "#10B981",
    primaryDark: "#34D399",
    gradient: ["#10B981", "#059669"],
    gradientDark: ["#10B981", "#047857"],
    bgLight: "#ECFDF5",
    bgDark: "#1A2E26",
    cardDark: "#264D3D",
    chipDark: "#306B52",
  },
  Teal: {
    primary: "#14B8A6",
    primaryDark: "#2DD4BF",
    gradient: ["#14B8A6", "#0D9488"],
    gradientDark: ["#14B8A6", "#0F766E"],
    bgLight: "#F0FDFA",
    bgDark: "#1A2625",
    cardDark: "#264040",
    chipDark: "#305A58",
  },
  Orange: {
    primary: "#F97316",
    primaryDark: "#FB923C",
    gradient: ["#F97316", "#EA580C"],
    gradientDark: ["#F97316", "#C2410C"],
    bgLight: "#FFF7ED",
    bgDark: "#2D1F14",
    cardDark: "#44301A",
    chipDark: "#5A3D20",
  },
  Pink: {
    primary: "#EC4899",
    primaryDark: "#F472B6",
    gradient: ["#EC4899", "#DB2777"],
    gradientDark: ["#EC4899", "#BE185D"],
    bgLight: "#FDF2F8",
    bgDark: "#2D1A25",
    cardDark: "#44263A",
    chipDark: "#5A3350",
  },
};

const THEME_NAMES = Object.keys(THEMES);

export default function App() {
  // System color scheme
  const systemColorScheme = useColorScheme();

  // Core state
  const [themeMode, setThemeMode] = useState("System"); // "Light", "Dark", "System"
  const [themeColor, setThemeColor] = useState("Purple");
  const [screen, setScreen] = useState("home");
  const [expenses, setExpenses] = useState([]);
  const [apiKey, setApiKey] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [customCategories, setCustomCategories] = useState([]);

  // Filters
  const [dateFilter, setDateFilter] = useState("All Time");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Custom date range
  const [customStartDate, setCustomStartDate] = useState(subDays(new Date(), 30));
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [pickingDateType, setPickingDateType] = useState("start");

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  // Date picker for edit
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Custom dialog
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogButtons, setDialogButtons] = useState([]);

  // Add category modal
  const [addCategoryModal, setAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Custom currencies
  const [customCurrencies, setCustomCurrencies] = useState([]);
  const [addCurrencyModal, setAddCurrencyModal] = useState(false);
  const [newCurrencyName, setNewCurrencyName] = useState("");

  // Category scroll position
  const categoryScrollRef = useRef(null);
  const categoryScrollPos = useRef(0);

  // Determine actual dark mode based on theme mode
  const isDarkMode = themeMode === "System"
    ? systemColorScheme === "dark"
    : themeMode === "Dark";

  // Get current theme colors
  const currentTheme = THEMES[themeColor];
  const primaryColor = isDarkMode ? currentTheme.primaryDark : currentTheme.primary;
  const gradientColors = isDarkMode ? currentTheme.gradientDark : currentTheme.gradient;

  const theme = isDarkMode
    ? { ...MD3DarkTheme, colors: { ...MD3DarkTheme.colors, primary: currentTheme.primaryDark, background: currentTheme.bgDark, surface: currentTheme.cardDark } }
    : { ...MD3LightTheme, colors: { ...MD3LightTheme.colors, primary: currentTheme.primary, background: currentTheme.bgLight, surface: "#FFFFFF" } };

  const textColor = isDarkMode ? "#FFFFFF" : "#1F2937";
  const subTextColor = isDarkMode ? "#9CA3AF" : "#6B7280";
  const cardBg = isDarkMode ? currentTheme.cardDark : "#FFFFFF";
  const chipBg = isDarkMode ? currentTheme.chipDark : "#E5E7EB";
  const bgColor = isDarkMode ? currentTheme.bgDark : currentTheme.bgLight;

  // All categories including custom
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  // All currencies including custom
  const defaultCurrencies = ["INR", "USD", "EUR", "GBP"];
  const allCurrencies = [...defaultCurrencies, ...customCurrencies];

  // Custom dialog function
  function showDialog(title, message, buttons = [{ text: "OK", onPress: () => { } }]) {
    setDialogTitle(title);
    setDialogMessage(message);
    setDialogButtons(buttons);
    setDialogVisible(true);
  }

  function hideDialog() {
    setDialogVisible(false);
  }

  // Handle date filter selection - directly show date picker for custom
  function handleDateFilterSelect(filter) {
    if (filter === "Custom") {
      setDateFilter("Custom");
      setShowCustomDateModal(true);
    } else {
      setDateFilter(filter);
    }
  }

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    let result = [...expenses];
    const today = new Date();

    if (dateFilter === "Last Month") {
      const lastMonthStart = startOfMonth(subDays(startOfMonth(today), 1));
      const lastMonthEnd = subDays(startOfMonth(today), 1);
      result = result.filter((e) => {
        try {
          const expDate = parseISO(e.date);
          return isAfter(expDate, subDays(lastMonthStart, 1)) && isBefore(expDate, subDays(lastMonthEnd, -1));
        } catch {
          return true;
        }
      });
    } else if (dateFilter === "This Month") {
      const monthStart = startOfMonth(today);
      result = result.filter((e) => {
        try {
          return isAfter(parseISO(e.date), monthStart);
        } catch {
          return true;
        }
      });
    } else if (dateFilter === "Custom") {
      result = result.filter((e) => {
        try {
          const expDate = parseISO(e.date);
          return isAfter(expDate, subDays(customStartDate, 1)) && isBefore(expDate, subDays(customEndDate, -1));
        } catch {
          return true;
        }
      });
    }

    if (categoryFilter !== "All") {
      result = result.filter((e) => e.category === categoryFilter);
    }

    return result.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, dateFilter, categoryFilter, customStartDate, customEndDate]);

  const totalExpense = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Pick and process images
  async function handleScanReceipt() {
    if (!apiKey.trim()) {
      showDialog(
        "API Key Required 🔑",
        "Please add your API key in the settings!",
        [
          { text: "Cancel", onPress: hideDialog },
          { text: "Go to Settings", onPress: () => { hideDialog(); setScreen("settings"); } },
        ]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setIsProcessing(true);
      const images = result.assets;
      const newExpenses = [];

      for (let i = 0; i < images.length; i++) {
        setProcessingStatus(`🔍 Processing ${i + 1} of ${images.length}...`);

        try {
          const data = await analyzeReceipt({
            apiKey: apiKey.trim(),
            base64: images[i].base64,
          });

          newExpenses.push({
            id: `${Date.now()}_${i}_${Math.random()}`,
            merchant: data.merchant || "Unknown Store",
            amount: data.total_amount || 0,
            currency: data.currency || currency,
            date: data.date || new Date().toISOString().slice(0, 10),
            category: data.category || "Others",
            payment_method: data.payment_method || "Card",
          });
        } catch (err) {
          console.log("Error processing image:", err);
        }
      }

      setIsProcessing(false);
      setProcessingStatus("");

      if (newExpenses.length > 0) {
        setExpenses((prev) => [...newExpenses, ...prev]);
        showDialog("Success ✅", `${newExpenses.length} receipts processed`, [
          { text: "OK", onPress: hideDialog }
        ]);
      } else {
        showDialog("No Data ⚠️", "Could not extract data from the receipts.", [
          { text: "OK", onPress: hideDialog }
        ]);
      }
    } catch (err) {
      console.log("Image picker error:", err);
      setIsProcessing(false);
      setProcessingStatus("");
      showDialog("Error", "Something went wrong. Please try again.", [
        { text: "OK", onPress: hideDialog }
      ]);
    }
  }

  // Edit handlers
  function openEdit(item) {
    setEditItem({ ...item });
    setEditModal(true);
  }

  function saveEdit() {
    if (!editItem) return;
    setExpenses((prev) => prev.map((e) => (e.id === editItem.id ? editItem : e)));
    setEditModal(false);
    setEditItem(null);
  }

  function deleteExpense() {
    if (!editItem) return;
    showDialog("Delete Transaction?", "Are you sure you want to remove this transaction?", [
      { text: "Cancel", onPress: hideDialog },
      {
        text: "Delete",
        onPress: () => {
          setExpenses((prev) => prev.filter((e) => e.id !== editItem.id));
          setEditModal(false);
          setEditItem(null);
          hideDialog();
        },
        style: "destructive"
      },
    ]);
  }

  // Date picker handler for edit
  function onDateChange(event, selectedDate) {
    setShowDatePicker(false);
    if (selectedDate && editItem) {
      const formattedDate = selectedDate.toISOString().slice(0, 10);
      setEditItem({ ...editItem, date: formattedDate });
    }
  }

  // Date picker handler for custom range
  function onCustomDateChange(event, selectedDate) {
    if (selectedDate) {
      if (pickingDateType === "start") {
        setCustomStartDate(selectedDate);
      } else {
        setCustomEndDate(selectedDate);
      }
    }
  }

  // Add custom category
  function addCustomCategory() {
    const trimmed = newCategoryName.trim();
    if (trimmed && !allCategories.includes(trimmed)) {
      setCustomCategories((prev) => [...prev, trimmed]);
      CATEGORY_EMOJIS[trimmed] = "🏷️";
    }
    setNewCategoryName("");
    setAddCategoryModal(false);
  }

  // Add custom currency
  function addCustomCurrency() {
    const trimmed = newCurrencyName.trim().toUpperCase();
    if (trimmed && !allCurrencies.includes(trimmed)) {
      setCustomCurrencies((prev) => [...prev, trimmed]);
    }
    setNewCurrencyName("");
    setAddCurrencyModal(false);
  }

  // Select currency suggestion
  function selectCurrencySuggestion(curr) {
    if (!allCurrencies.includes(curr)) {
      setCustomCurrencies((prev) => [...prev, curr]);
    }
    setNewCurrencyName("");
    setAddCurrencyModal(false);
  }

  // Delete custom currency
  function deleteCustomCurrency(curr) {
    showDialog("Delete Currency?", `Remove "${curr}" from your currencies?`, [
      { text: "Cancel", onPress: hideDialog },
      {
        text: "Delete",
        onPress: () => {
          setCustomCurrencies((prev) => prev.filter((c) => c !== curr));
          if (currency === curr) setCurrency("INR");
          hideDialog();
        },
        style: "destructive"
      },
    ]);
  }

  // Delete custom category
  function deleteCustomCategory(cat) {
    showDialog("Delete Category?", `Remove "${cat}" from your categories?`, [
      { text: "Cancel", onPress: hideDialog },
      {
        text: "Delete",
        onPress: () => {
          setCustomCategories((prev) => prev.filter((c) => c !== cat));
          hideDialog();
        },
        style: "destructive"
      },
    ]);
  }

  // Chip component
  const FilterChip = ({ label, selected, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.filterChip,
        { backgroundColor: selected ? primaryColor : chipBg },
      ]}
    >
      <Text style={{ color: selected ? "#FFF" : textColor, fontWeight: selected ? "bold" : "normal", fontSize: 13 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // HOME SCREEN
  const HomeScreen = () => (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Header - Transparent */}
        <View style={styles.header}>
          <Text style={[styles.appTitle, { color: textColor }]}>MoneyTrack 📊</Text>
          <TouchableOpacity onPress={() => setScreen("settings")}>
            <Text style={{ fontSize: 24 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Card - Left-aligned with fading gradient */}
        <LinearGradient
          colors={[...gradientColors, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroLabel}>Total Spent ({dateFilter})</Text>
          <Text style={styles.heroAmount}>{currency} {totalExpense.toFixed(2)}</Text>
          <Text style={styles.heroSub}>{filteredExpenses.length} transactions</Text>
        </LinearGradient>

        {/* Date Filters */}
        <Text style={[styles.sectionLabel, { color: textColor }]}>Time Period:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {DATE_FILTERS.map((f) => (
            <FilterChip
              key={f}
              label={f === "Custom" && dateFilter === "Custom"
                ? `${format(customStartDate, "dd/MM")} - ${format(customEndDate, "dd/MM")}`
                : f}
              selected={dateFilter === f}
              onPress={() => handleDateFilterSelect(f)}
            />
          ))}
        </ScrollView>

        {/* Category Filters */}
        <Text style={[styles.sectionLabel, { color: textColor }]}>Category:</Text>
        <ScrollView
          ref={categoryScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          onScroll={(e) => { categoryScrollPos.current = e.nativeEvent.contentOffset.x; }}
          scrollEventThrottle={16}
          contentOffset={{ x: categoryScrollPos.current, y: 0 }}
        >
          <FilterChip label="🌟 All" selected={categoryFilter === "All"} onPress={() => setCategoryFilter("All")} />
          {allCategories.map((c) => (
            <FilterChip
              key={c}
              label={`${CATEGORY_EMOJIS[c] || "🏷️"} ${c}`}
              selected={categoryFilter === c}
              onPress={() => setCategoryFilter(c)}
            />
          ))}
        </ScrollView>

        {/* Transactions */}
        <Text style={[styles.sectionLabel, { color: textColor }]}>Recent Transactions: 📋</Text>
        <Text style={[styles.sectionSub, { color: subTextColor }]}>Tap to edit</Text>

        {filteredExpenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 60 }}>📭</Text>
            <Text style={{ color: subTextColor, marginTop: 12 }}>No expenses yet</Text>
          </View>
        ) : (
          filteredExpenses.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => openEdit(item)}>
              <View style={[styles.transactionCard, { backgroundColor: cardBg }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.merchantName, { color: textColor }]}>
                    {item.merchant} {CATEGORY_EMOJIS[item.category] || "📦"}
                  </Text>
                  <Text style={{ color: subTextColor, fontSize: 12 }}>
                    {formatDate(item.date)} • {item.category}
                  </Text>
                </View>
                <Text style={styles.amountText}>-{item.currency} {item.amount}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Fixed Scan Button at Bottom */}
      <View style={[styles.fixedBottomButton, { backgroundColor: bgColor }]}>
        <TouchableOpacity style={styles.scanButton} onPress={handleScanReceipt} disabled={isProcessing}>
          <LinearGradient colors={gradientColors} style={styles.scanButtonGradient}>
            <Text style={styles.scanButtonText}>Scan Receipt</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  // SETTINGS SCREEN
  const SettingsScreen = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      {/* Header */}
      <View style={styles.settingsHeader}>
        <TouchableOpacity onPress={() => setScreen("home")}>
          <Text style={{ fontSize: 24 }}>⬅️</Text>
        </TouchableOpacity>
        <Text style={[styles.settingsTitle, { color: textColor }]}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* API Key */}
      <View style={[styles.settingCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.settingLabel, { color: textColor }]}>Gemini API Key:</Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="Paste your API key here"
          placeholderTextColor={subTextColor}
          secureTextEntry
          style={[styles.thinInput, { color: textColor, borderColor: isDarkMode ? "#4B5563" : "#D1D5DB" }]}
        />
      </View>

      {/* Currency */}
      <View style={[styles.settingCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.settingLabel, { color: textColor }]}>Currency:</Text>
        <Text style={{ color: subTextColor, fontSize: 11, marginTop: 2 }}>Long press custom currency to delete</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 8 }}>
          {allCurrencies.map((c) => {
            const isCustom = customCurrencies.includes(c);
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCurrency(c)}
                onLongPress={isCustom ? () => deleteCustomCurrency(c) : undefined}
                delayLongPress={500}
                style={[
                  styles.currencyChip,
                  { backgroundColor: currency === c ? primaryColor : chipBg },
                ]}
              >
                <Text style={{ color: currency === c ? "#FFF" : textColor }}>
                  {c === "INR" ? "🇮🇳 " : c === "USD" ? "🇺🇸 " : c === "EUR" ? "🇪🇺 " : c === "GBP" ? "🇬🇧 " : "💰 "}{c}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.addCurrencyBtn, { borderColor: primaryColor }]}
            onPress={() => setAddCurrencyModal(true)}
          >
            <Text style={{ color: primaryColor, fontWeight: "bold" }}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Custom Categories */}
      <View style={[styles.settingCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.settingLabel, { color: textColor }]}>Custom Categories:</Text>
        <Text style={{ color: subTextColor, fontSize: 11, marginTop: 2 }}>Long press to delete</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 8 }}>
          {customCategories.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.customCatChip, { backgroundColor: chipBg }]}
              onLongPress={() => deleteCustomCategory(c)}
              delayLongPress={500}
            >
              <Text style={{ color: textColor }}>🏷️ {c}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.addCatButton, { borderColor: primaryColor }]}
            onPress={() => setAddCategoryModal(true)}
          >
            <Text style={{ color: primaryColor, fontWeight: "bold" }}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Appearance Mode */}
      <View style={[styles.settingCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.settingLabel, { color: textColor }]}>Appearance:</Text>
        <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
          {["Light", "Dark", "System"].map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setThemeMode(mode)}
              style={[
                styles.appearanceChip,
                {
                  backgroundColor: themeMode === mode ? primaryColor : chipBg,
                  borderWidth: 1,
                  borderColor: themeMode === mode ? primaryColor : (isDarkMode ? "#4B5563" : "#D1D5DB"),
                },
              ]}
            >
              <Text style={{ marginRight: 6 }}>
                {mode === "Light" ? "☀️" : mode === "Dark" ? "🌙" : "📱"}
              </Text>
              <Text style={{ color: themeMode === mode ? "#FFF" : textColor, fontWeight: "500" }}>
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Theme Color */}
      <View style={[styles.settingCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.settingLabel, { color: textColor }]}>Theme Color:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {THEME_NAMES.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setThemeColor(t)}
              style={[
                styles.themeColorChip,
                {
                  backgroundColor: THEMES[t].primary,
                  borderWidth: 2,
                  borderColor: themeColor === t ? "#FFF" : THEMES[t].primary,
                },
              ]}
            >
              <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 12 }}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* About */}
      <View style={[styles.settingCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.settingLabel, { color: textColor }]}>About MoneyTrack:</Text>
        <Text style={{ color: subTextColor, fontSize: 12, marginTop: 4 }}>
          Version 1.0 • Powered by Gemini AI and{" "}
          <Text
            style={{ color: primaryColor, textDecorationLine: "underline" }}
            onPress={() => Linking.openURL("https://navygeeks.in")}
          >
            NavyGeeks
          </Text>
        </Text>
      </View>
    </ScrollView>
  );

  // EDIT MODAL
  const EditModal = () => (
    <Modal visible={editModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
          <Text style={[styles.modalTitle, { color: textColor }]}>Edit Transaction ✏️</Text>

          {editItem && (
            <>
              <Text style={[styles.inputLabel, { color: textColor }]}>Merchant:</Text>
              <TextInput
                value={editItem.merchant}
                onChangeText={(t) => setEditItem({ ...editItem, merchant: t })}
                style={[styles.thinInput, { color: textColor, borderColor: isDarkMode ? "#4B5563" : "#D1D5DB" }]}
              />

              <Text style={[styles.inputLabel, { color: textColor }]}>Amount:</Text>
              <TextInput
                value={String(editItem.amount)}
                onChangeText={(t) => setEditItem({ ...editItem, amount: parseFloat(t) || 0 })}
                keyboardType="numeric"
                style={[styles.thinInput, { color: textColor, borderColor: isDarkMode ? "#4B5563" : "#D1D5DB" }]}
              />

              <Text style={[styles.inputLabel, { color: textColor }]}>Date:</Text>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: isDarkMode ? "#4B5563" : "#D1D5DB" }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: textColor }}>{formatDate(editItem.date)}</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={new Date(editItem.date)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onDateChange}
                  themeVariant={isDarkMode ? "dark" : "light"}
                />
              )}

              <Text style={[styles.inputLabel, { color: textColor }]}>Category 🏷️</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {allCategories.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setEditItem({ ...editItem, category: c })}
                    style={[
                      styles.catChip,
                      { backgroundColor: editItem.category === c ? primaryColor : chipBg },
                    ]}
                  >
                    <Text style={{ color: editItem.category === c ? "#FFF" : textColor, fontSize: 12 }}>
                      {CATEGORY_EMOJIS[c] || "🏷️"} {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: chipBg }]}
                  onPress={() => { setEditModal(false); setEditItem(null); }}
                >
                  <Text style={{ color: textColor }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: primaryColor }]} onPress={saveEdit}>
                  <Text style={{ color: "#FFF", fontWeight: "bold" }}>Save 💾</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.deleteBtn} onPress={deleteExpense}>
                <Text style={{ color: "#FFF", fontWeight: "bold" }}>Delete Transaction 🗑️</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // CUSTOM DATE RANGE MODAL - Simple text input for dates
  const CustomDateModal = () => {
    const [startInput, setStartInput] = useState(format(customStartDate, "dd/MM/yy"));
    const [endInput, setEndInput] = useState(format(customEndDate, "dd/MM/yy"));

    const parseDate = (str) => {
      try {
        const parts = str.split("/");
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          let year = parseInt(parts[2]);
          if (year < 100) year += 2000;
          return new Date(year, month, day);
        }
      } catch { }
      return null;
    };

    const handleApply = () => {
      const start = parseDate(startInput);
      const end = parseDate(endInput);
      if (start && end) {
        setCustomStartDate(start);
        setCustomEndDate(end);
        setDateFilter("Custom");
      }
      setShowCustomDateModal(false);
    };

    return (
      <Modal visible={showCustomDateModal} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogBox, { backgroundColor: cardBg }]}>
            <Text style={[styles.dialogTitle, { color: textColor }]}>Custom Date Range</Text>

            <Text style={[styles.inputLabel, { color: textColor }]}>From (dd/mm/yy):</Text>
            <TextInput
              value={startInput}
              onChangeText={setStartInput}
              placeholder="01/01/24"
              placeholderTextColor={subTextColor}
              keyboardType="numeric"
              maxLength={8}
              style={[styles.thinInput, { color: textColor, borderColor: isDarkMode ? "#4B5563" : "#D1D5DB" }]}
            />

            <Text style={[styles.inputLabel, { color: textColor, marginTop: 12 }]}>To (dd/mm/yy):</Text>
            <TextInput
              value={endInput}
              onChangeText={setEndInput}
              placeholder="31/12/24"
              placeholderTextColor={subTextColor}
              keyboardType="numeric"
              maxLength={8}
              style={[styles.thinInput, { color: textColor, borderColor: isDarkMode ? "#4B5563" : "#D1D5DB" }]}
            />

            <View style={[styles.dialogButtons, { marginTop: 20 }]}>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: chipBg }]}
                onPress={() => setShowCustomDateModal(false)}
              >
                <Text style={{ color: textColor }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: primaryColor }]}
                onPress={handleApply}
              >
                <Text style={{ color: "#FFF", fontWeight: "600" }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // PROCESSING OVERLAY
  const ProcessingOverlay = () => (
    <Modal visible={isProcessing} transparent>
      <View style={styles.processingOverlay}>
        <View style={[styles.processingCard, { backgroundColor: cardBg }]}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.processingText, { color: textColor }]}>{processingStatus || "Processing..."}</Text>
        </View>
      </View>
    </Modal>
  );

  // CUSTOM DIALOG
  const CustomDialog = () => (
    <Modal visible={dialogVisible} transparent animationType="fade">
      <View style={styles.dialogOverlay}>
        <View style={[styles.dialogBox, { backgroundColor: cardBg }]}>
          <Text style={[styles.dialogTitle, { color: textColor }]}>{dialogTitle}</Text>
          <Text style={[styles.dialogMessage, { color: subTextColor }]}>{dialogMessage}</Text>
          <View style={styles.dialogButtons}>
            {dialogButtons.map((btn, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dialogBtn,
                  btn.style === "destructive"
                    ? { backgroundColor: "#EF4444" }
                    : { backgroundColor: primaryColor }
                ]}
                onPress={btn.onPress}
              >
                <Text style={{ color: "#FFF", fontWeight: "600" }}>{btn.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );

  // ADD CATEGORY MODAL - Fixed input issue
  const AddCategoryModal = () => {
    const [localName, setLocalName] = useState("");

    const handleAdd = () => {
      const trimmed = localName.trim();
      if (trimmed && !allCategories.includes(trimmed)) {
        setCustomCategories((prev) => [...prev, trimmed]);
        CATEGORY_EMOJIS[trimmed] = "🏷️";
      }
      setLocalName("");
      setAddCategoryModal(false);
    };

    return (
      <Modal visible={addCategoryModal} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogBox, { backgroundColor: cardBg }]}>
            <Text style={[styles.dialogTitle, { color: textColor }]}>Add Category</Text>
            <TextInput
              value={localName}
              onChangeText={setLocalName}
              placeholder="Category name"
              placeholderTextColor={subTextColor}
              autoFocus
              style={[styles.thinInput, { color: textColor, borderColor: isDarkMode ? "#4B5563" : "#D1D5DB", marginBottom: 16 }]}
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: chipBg }]}
                onPress={() => { setLocalName(""); setAddCategoryModal(false); }}
              >
                <Text style={{ color: textColor }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: primaryColor }]}
                onPress={handleAdd}
              >
                <Text style={{ color: "#FFF", fontWeight: "600" }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ADD CURRENCY MODAL - Fixed input issue with suggestions
  const AddCurrencyModal = () => {
    const [localCurrency, setLocalCurrency] = useState("");

    const handleAdd = () => {
      const trimmed = localCurrency.trim().toUpperCase();
      if (trimmed && !allCurrencies.includes(trimmed)) {
        setCustomCurrencies((prev) => [...prev, trimmed]);
      }
      setLocalCurrency("");
      setAddCurrencyModal(false);
    };

    const handleSelectSuggestion = (curr) => {
      if (!allCurrencies.includes(curr)) {
        setCustomCurrencies((prev) => [...prev, curr]);
      }
      setLocalCurrency("");
      setAddCurrencyModal(false);
    };

    // Filter suggestions based on input and already added
    const filteredSuggestions = CURRENCY_SUGGESTIONS.filter(
      (c) => !allCurrencies.includes(c) && c.includes(localCurrency.toUpperCase())
    );

    return (
      <Modal visible={addCurrencyModal} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogBox, { backgroundColor: cardBg }]}>
            <Text style={[styles.dialogTitle, { color: textColor }]}>Add Currency</Text>
            <TextInput
              value={localCurrency}
              onChangeText={setLocalCurrency}
              placeholder="Currency code (e.g. JPY)"
              placeholderTextColor={subTextColor}
              autoCapitalize="characters"
              autoFocus
              maxLength={5}
              style={[styles.thinInput, { color: textColor, borderColor: isDarkMode ? "#4B5563" : "#D1D5DB", marginBottom: 12 }]}
            />

            {/* Suggestions */}
            <Text style={[styles.inputLabel, { color: subTextColor, marginBottom: 8 }]}>Suggestions:</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {filteredSuggestions.slice(0, 6).map((curr) => (
                <TouchableOpacity
                  key={curr}
                  style={[styles.suggestionChip, { backgroundColor: chipBg }]}
                  onPress={() => handleSelectSuggestion(curr)}
                >
                  <Text style={{ color: textColor }}>{curr}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: chipBg }]}
                onPress={() => { setLocalCurrency(""); setAddCurrencyModal(false); }}
              >
                <Text style={{ color: textColor }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: primaryColor }]}
                onPress={handleAdd}
              >
                <Text style={{ color: "#FFF", fontWeight: "600" }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
          <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
          {screen === "home" ? <HomeScreen /> : <SettingsScreen />}
          <EditModal />
          <CustomDateModal />
          <ProcessingOverlay />
          <CustomDialog />
          <AddCategoryModal />
          <AddCurrencyModal />
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

function formatDate(dateStr) {
  try {
    return format(parseISO(dateStr), "dd MMM yy");
  } catch {
    return dateStr;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 8,
  },
  appTitle: { fontSize: 24, fontWeight: "bold" },
  heroCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "flex-start",
  },
  heroLabel: { color: "rgba(255,255,255,0.9)", fontSize: 14 },
  heroAmount: { color: "#FFF", fontSize: 32, fontWeight: "bold", marginTop: 4 },
  heroSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 4 },
  sectionLabel: { marginLeft: 16, marginTop: 12, marginBottom: 8, fontWeight: "600" },
  sectionSub: { marginLeft: 16, marginBottom: 8, fontSize: 12 },
  filterRow: { paddingHorizontal: 16, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  transactionCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  merchantName: { fontWeight: "600", marginBottom: 4 },
  amountText: { color: "#EF4444", fontWeight: "bold", fontSize: 16 },
  emptyState: { alignItems: "center", marginTop: 60, marginBottom: 40 },
  fixedBottomButton: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingBottom: 16,
  },
  scanButton: { width: "100%" },
  scanButtonGradient: {
    padding: 14,
    borderRadius: 25,
    alignItems: "center",
  },
  scanButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  settingsTitle: { fontSize: 22, fontWeight: "bold" },
  settingCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  settingRow: { flexDirection: "row", alignItems: "center" },
  settingLabel: { fontWeight: "600", fontSize: 16 },
  thinInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    fontSize: 14,
    height: 40,
  },
  currencyChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addCurrencyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  themeColorChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  appearanceChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  customCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addCatButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  presetButton: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dateLabel: { fontWeight: "500", fontSize: 15 },
  inputLabel: { marginBottom: 4, marginTop: 8, fontWeight: "500" },
  dateButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
  },
  modalBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  deleteBtn: {
    backgroundColor: "#EF4444",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  processingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  processingCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: "center",
    width: "80%",
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "500",
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialogBox: {
    width: "90%",
    borderRadius: 16,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  dialogMessage: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  dialogButtons: {
    flexDirection: "row",
    gap: 10,
  },
  dialogBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
});
