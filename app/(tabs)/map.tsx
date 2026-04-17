/**
 * Маршрут только реэкспортирует контент: `react-native-maps` живёт в
 * `components/map/MapTabContent.native.tsx`, чтобы веб-бандл Expo Router не тянул нативные модули.
 */
export { default } from '@/components/map/MapTabContent';
