import { apiRequest } from "./apiClient";

export const getRecentSearches = () =>
  apiRequest("/search/recent", { method: "GET" });

export const addRecentSearch = (query) =>
  apiRequest("/search/recent", {
    method: "POST",
    body: JSON.stringify({ query }),
  });

export const removeRecentSearch = (id) =>
  apiRequest(`/search/recent/${id}`, { method: "DELETE" });

export const clearRecentSearches = () =>
  apiRequest("/search/recent", { method: "DELETE" });

export const getSearchHistory = () =>
  apiRequest("/search/history", { method: "GET" });

export const clearSearchHistory = () =>
  apiRequest("/search/history", { method: "DELETE" });
