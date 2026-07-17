import { noopAds, type AdsProvider } from "@/core";

/**
 * GAM-04: the AdMob SDK stays behind this seam. This build ships the no-op
 * provider; to add ads, pull in react-native-google-mobile-ads and implement
 * AdsProvider here — nothing else in the app changes.
 */
export const ads: AdsProvider = noopAds;
