import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { ConciergeScreen } from "../screens/ConciergeScreen";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { TripsScreen } from "../screens/TripsScreen";
import { DestinationDetailScreen } from "../screens/DestinationDetailScreen";
import { TripDetailScreen } from "../screens/TripDetailScreen";

const Tab = createBottomTabNavigator();
const ConciergeStack = createNativeStackNavigator();
const DiscoverStack = createNativeStackNavigator();
const TripsStack = createNativeStackNavigator();

const screenOptions = { headerShown: false, contentStyle: { backgroundColor: colors.background } };

function ConciergeStackNavigator() {
  return (
    <ConciergeStack.Navigator screenOptions={screenOptions}>
      <ConciergeStack.Screen name="ConciergeHome" component={ConciergeScreen} />
      <ConciergeStack.Screen name="DestinationDetail" component={DestinationDetailScreen} />
    </ConciergeStack.Navigator>
  );
}

function TripsStackNavigator() {
  return (
    <TripsStack.Navigator screenOptions={screenOptions}>
      <TripsStack.Screen name="TripsHome" component={TripsScreen} />
      <TripsStack.Screen name="TripDetail" component={TripDetailScreen} />
    </TripsStack.Navigator>
  );
}

function DiscoverStackNavigator() {
  return (
    <DiscoverStack.Navigator screenOptions={screenOptions}>
      <DiscoverStack.Screen name="DiscoverHome" component={DiscoverScreen} />
      <DiscoverStack.Screen name="DestinationDetail" component={DestinationDetailScreen} />
    </DiscoverStack.Navigator>
  );
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.accentTeal,
    text: colors.textPrimary,
  },
};

const TAB_ICONS = {
  Concierge: "compass",
  Seyahatlerim: "briefcase",
  Keşfet: "search",
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accentTeal,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 62,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS[route.name]} size={size - 2} color={color} />
          ),
        })}
      >
        <Tab.Screen name="Concierge" component={ConciergeStackNavigator} />
        <Tab.Screen name="Seyahatlerim" component={TripsStackNavigator} />
        <Tab.Screen name="Keşfet" component={DiscoverStackNavigator} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
