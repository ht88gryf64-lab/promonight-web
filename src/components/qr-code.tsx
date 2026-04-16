import QRCode from 'qrcode';

interface QrCodeProps {
  value: string;
  size?: number;
  caption?: string;
}

// Server-rendered QR code. Returns a data URI embedded into an <img>.
export async function QrCode({ value, size = 200, caption }: QrCodeProps) {
  const dataUrl = await QRCode.toDataURL(value, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: {
      dark: '#ffffff',
      light: '#0e1017',
    },
  });

  return (
    <figure className="inline-flex flex-col items-center">
      <div
        className="p-3 rounded-xl bg-bg-card border border-border-hover"
        style={{ width: size + 24, height: size + 24 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt={`QR code: ${value}`}
          width={size}
          height={size}
          className="block"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 font-mono text-[10px] tracking-[0.5px] uppercase text-text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
