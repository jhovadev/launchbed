// Same rules and messages as the Compose AuthValidator, so every target behaves alike.
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function emailError(email: string): string | null {
  const value = email.trim();
  if (value.length === 0) return "Enter an email address";
  if (!EMAIL_PATTERN.test(value)) return "Enter a valid email address";
  return null;
}

export function passwordError(password: string): string | null {
  if (password.length === 0) return "Enter a password";
  if (password.length < 8) return "Use at least 8 characters";
  return null;
}

export function confirmPasswordError(password: string, confirm: string): string | null {
  if (confirm.length === 0) return "Confirm your password";
  if (confirm !== password) return "Passwords do not match";
  return null;
}
