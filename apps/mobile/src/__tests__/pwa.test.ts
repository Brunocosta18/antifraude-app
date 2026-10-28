import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const publicDir = join(__dirname, '..', '..', 'public');
const manifest = JSON.parse(readFileSync(join(publicDir, 'manifest.json'), 'utf8')) as {
  start_url: string;
  display: string;
  theme_color: string;
  icons: { src: string; sizes: string }[];
};

describe('manifest PWA', () => {
  it('é instalável em modo standalone com a cor de tema do app', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#208AEF');
    expect(manifest.start_url).toBe('/');
  });

  it('declara ícones 192 e 512 que existem em disco', () => {
    for (const size of ['192x192', '512x512']) {
      const icon = manifest.icons.find((i) => i.sizes === size);
      expect(icon).toBeDefined();
      expect(existsSync(join(publicDir, icon!.src))).toBe(true);
    }
  });
});
