import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('manifest.json', () => {
	const manifestPath = join(process.cwd(), 'manifest.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

	it('has id set to "tablify"', () => {
		expect(manifest.id).toBe('tablify');
	});

	it('has name set to "Tablify"', () => {
		expect(manifest.name).toBe('Tablify');
	});

	it('has isDesktopOnly set to false (mobile support)', () => {
		expect(manifest.isDesktopOnly).toBe(false);
	});

	it('has minAppVersion present and non-empty', () => {
		expect(manifest.minAppVersion).toBeDefined();
		expect(typeof manifest.minAppVersion).toBe('string');
		expect(manifest.minAppVersion.length).toBeGreaterThan(0);
	});

	it('has version in semver format', () => {
		// Plain x.y.z, or x.y.z with a semver pre-release tag (e.g. 2.0.0-beta.1 for a beta release).
		expect(manifest.version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
	});

	it('has description present', () => {
		expect(manifest.description).toBeDefined();
		expect(typeof manifest.description).toBe('string');
		expect(manifest.description.length).toBeGreaterThan(0);
	});

	it('does not reference .tabula anywhere', () => {
		const raw = readFileSync(manifestPath, 'utf-8');
		expect(raw.toLowerCase()).not.toContain('tabula');
	});
});
