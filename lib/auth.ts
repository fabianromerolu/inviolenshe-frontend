import Cookies from "js-cookie";

const COOKIE_NAME = "auth_token";
const COOKIE_EXPIRES = 30; // días

export function getToken(): string | undefined {
  return Cookies.get(COOKIE_NAME);
}

export function setToken(token: string): void {
  Cookies.set(COOKIE_NAME, token, { expires: COOKIE_EXPIRES, sameSite: "lax" });
}

export function removeToken(): void {
  Cookies.remove(COOKIE_NAME);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
