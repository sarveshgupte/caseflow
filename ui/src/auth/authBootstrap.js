let bootstrapPromise = null;

export function bootstrapAuth(fetchProfile) {
  if (!bootstrapPromise) {
    bootstrapPromise = fetchProfile();
  }
  return bootstrapPromise;
}
