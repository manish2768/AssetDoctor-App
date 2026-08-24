import React from 'react';
import { X, Phone, MessageSquare, Wrench, ShieldAlert, Bike, Droplets, Wind, Car, Zap, UserCheck, AlertOctagon } from 'lucide-react';
import { EmergencyContact } from '../types';

interface EmergencyContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'emg-1',
    name: 'TVS & Two-Wheeler Roadside Mechanic',
    category: 'Bike Service & Breakdown',
    phone: '+91 98765 12345',
    availability: '24x7 Emergency Service',
    iconName: 'Bike',
  },
  {
    id: 'emg-2',
    name: 'Kent & RO Water Filter Specialist',
    category: 'RO Purifier Maintenance',
    phone: '+91 98111 22334',
    availability: 'Mon-Sat 9 AM - 8 PM',
    iconName: 'Droplets',
  },
  {
    id: 'emg-3',
    name: 'AC Gas Refill & Servicing Engineer',
    category: 'AC & Cooling Repair',
    phone: '+91 98222 33445',
    availability: 'Instant Same-Day Visit',
    iconName: 'Wind',
  },
  {
    id: 'emg-4',
    name: 'Car Breakdown Towing Helpline',
    category: 'Car Roadside Assistance',
    phone: '+91 1800 102 9001',
    availability: '24x7 Toll Free Support',
    iconName: 'Car',
  },
  {
    id: 'emg-5',
    name: 'Home Appliance & Electrical Repair',
    category: 'Electrician & TV / Washer Repair',
    phone: '+91 98444 55667',
    availability: 'Local Verified Mechanic',
    iconName: 'Zap',
  },
  {
    id: 'emg-6',
    name: 'AssetDoctor Warranty Claim Officer',
    category: 'Official Claim Support Desk',
    phone: '+91 1800 209 5555',
    availability: '24x7 Priority Desk',
    iconName: 'ShieldAlert',
  },
];

export const EmergencyContactModal: React.FC<EmergencyContactModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Bike':
        return <Bike className="w-5 h-5 text-amber-400" />;
      case 'Droplets':
        return <Droplets className="w-5 h-5 text-cyan-400" />;
      case 'Wind':
        return <Wind className="w-5 h-5 text-teal-400" />;
      case 'Car':
        return <Car className="w-5 h-5 text-emerald-400" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-yellow-400" />;
      default:
        return <ShieldAlert className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div
        id="emergency-contact-modal-container"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 animate-pulse">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Emergency Help & Service Mechanic Directory
              </h2>
              <p className="text-xs text-slate-400">
                Direct hotline access for Bike, AC, RO Water Purifier, Car & Home Appliance repairs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/60 to-cyan-950/60 border border-teal-500/30 flex items-center gap-3">
            <UserCheck className="w-6 h-6 text-teal-400 shrink-0" />
            <p className="text-xs text-slate-300 leading-relaxed">
              Need immediate technician assistance? Select a verified partner below to dial directly or trigger an automated WhatsApp repair request with your asset specs pre-filled.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {EMERGENCY_CONTACTS.map((contact) => (
              <div
                key={contact.id}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {contact.category}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {contact.availability}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-slate-700 transition-colors">
                      {renderIcon(contact.iconName)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 group-hover:text-teal-300 transition-colors">
                        {contact.name}
                      </h4>
                      <p className="text-xs font-mono font-bold text-slate-400 mt-0.5">
                        {contact.phone}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center gap-2">
                  <a
                    href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Call Now</span>
                  </a>

                  <a
                    href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `Hello ${contact.name}, I need urgent repair/service assistance for my asset registered on AssetDoctor.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                    <span>WhatsApp</span>
                  </a>
                </div>

              </div>
            ))}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-between items-center text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-teal-400" />
            <span>24/7 Verified Service Mechanics Hotline</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
