export const colors = {
  primary: '#10b981', // Updated Green from Tailwind's green-500
  secondary: '#6B7280', // Gray for secondary text/elements
  background: '#FFFFFF', // White
  card: '#F9FAFB', // Light Gray for cards
  text: '#1F2937', // Dark Gray for primary text
  textSecondary: '#6B7280', // Gray for secondary text
  border: '#E5E7EB', // Light Gray for borders
  positive: '#10B981', // Keep this distinct positive green for now
  negative: '#EF4444', // Red for negative changes, sell, delete actions
  warning: '#F59E0B', // Amber for warnings
  info: '#3B82F6', // Blue for informational messages
  // Add other specific colors if needed
};

export type ColorTheme = typeof colors;
