import { browser } from '$app/environment';

const STORAGE_KEY = 'fana-cumik_impl';

export function getImpl(): string | null {
    if (!browser) return null;
    return localStorage.getItem(STORAGE_KEY);
}

export function setImpl(implId: string): void {
    if (!browser) return;
    localStorage.setItem(STORAGE_KEY, implId);
}
