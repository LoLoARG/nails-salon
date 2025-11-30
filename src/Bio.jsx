import React from 'react';
import { MapPin, MessageCircle, Calendar, Instagram } from 'lucide-react';

export default function Bio() {
  const buttons = [
    { id: 1, text: 'Ubicación', icon: MapPin, link: 'https://maps.app.goo.gl/LiXdyhWWzRu2qCBu5' },
    { id: 2, text: 'WhatsApp', icon: MessageCircle, link: 'https://wa.me/5493625351595' },
    { id: 3, text: 'Agendar tu turno', icon: Calendar, link: '/' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-pink-100 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
      <h1 className="text-6xl font-bold text-rose-300 mb-2">By April</h1>
      <p className="text-sm text-gray-600 font-medium mb-6">𝐂𝐎𝐌𝐄𝐓𝐄 𝐄𝐋 𝐌𝐔𝐍𝐃𝐎 𝐍𝐎 𝐓𝐔𝐒 𝐔Ñ𝐀𝐒💅🏼</p>
        <a href="https://www.instagram.com/nails_by_aprill" target="_blank" rel="noopener noreferrer" className="inline-block hover:scale-110 transition-transform">
          <Instagram size={40} className="text-gray-700" />
        </a>
      </div>
      <div className="w-full max-w-md space-y-4">
        {buttons.map((button) => {
          const Icon = button.icon;
          return (
            <a key={button.id} href={button.link} target={button.id !== 3 ? "_blank" : "_self"} rel="noopener noreferrer" className="w-full bg-gradient-to-r from-rose-100 to-pink-100 hover:from-rose-200 hover:to-pink-200 text-gray-800 py-6 px-8 rounded-full text-center font-medium text-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-3">
              <Icon size={24} />
              {button.text}
            </a>
          );
        })}
      </div>
      <div className="mt-16 text-center">
        <p className="text-gray-500 text-sm">💅 Nails by April</p>
        <p className="text-gray-400 text-xs mt-1">Resistencia, Chaco</p>
      </div>
    </div>
  );
}