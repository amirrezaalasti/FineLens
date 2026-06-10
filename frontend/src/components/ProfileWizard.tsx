"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, User } from "lucide-react";
import { getProfile, saveProfile } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

interface ProfileWizardProps {
  userId: string;
  onComplete?: () => void;
}

const STEPS = [
  { id: "personal", title: "Persönliche Daten" },
  { id: "address", title: "Adresse" },
  { id: "case", title: "Rechtliches Anliegen" },
];

const EMPTY: UserProfile = {
  id: "default",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  street: "",
  postal_code: "",
  city: "",
  country: "Deutschland",
  date_of_birth: "",
  nationality: "deutsch",
  legal_topic: "",
  case_description: "",
  preferred_language: "de",
};

export function ProfileWizard({ userId, onComplete }: ProfileWizardProps) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>({ ...EMPTY, id: userId });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile(userId)
      .then(setProfile)
      .catch(() => setProfile({ ...EMPTY, id: userId }));
  }, [userId]);

  const update = (field: keyof UserProfile, value: string) => {
    setProfile((p) => ({ ...p, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile(profile);
      setSaved(true);
      if (step === STEPS.length - 1) onComplete?.();
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40";

  return (
    <div className="glass mx-auto max-w-2xl rounded-2xl p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy/5">
          <User className="h-6 w-6 text-navy" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-semibold text-navy">Mein Profil</h2>
          <p className="text-sm text-slate-500">
            Ihre Daten werden für vorausgefüllte Formulare verwendet
          </p>
        </div>
      </div>

      <div className="mb-8 flex gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(i)}
            className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
              i === step
                ? "bg-navy text-white"
                : i < step
                  ? "bg-green-50 text-green-800"
                  : "bg-navy/5 text-slate-500"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                i < step ? "bg-green-500 text-white" : "bg-white/20"
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="hidden sm:inline">{s.title}</span>
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Vorname</label>
            <input className={inputClass} value={profile.first_name} onChange={(e) => update("first_name", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nachname</label>
            <input className={inputClass} value={profile.last_name} onChange={(e) => update("last_name", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">E-Mail</label>
            <input type="email" className={inputClass} value={profile.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Telefon</label>
            <input className={inputClass} value={profile.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Geburtsdatum</label>
            <input type="date" className={inputClass} value={profile.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Staatsangehörigkeit</label>
            <input className={inputClass} value={profile.nationality} onChange={(e) => update("nationality", e.target.value)} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Straße und Hausnummer</label>
            <input className={inputClass} value={profile.street} onChange={(e) => update("street", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">PLZ</label>
              <input className={inputClass} value={profile.postal_code} onChange={(e) => update("postal_code", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Stadt</label>
              <input className={inputClass} value={profile.city} onChange={(e) => update("city", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Land</label>
            <input className={inputClass} value={profile.country} onChange={(e) => update("country", e.target.value)} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Rechtsthema</label>
            <select
              className={inputClass}
              value={profile.legal_topic}
              onChange={(e) => update("legal_topic", e.target.value)}
            >
              <option value="">Bitte wählen...</option>
              <option value="mietrecht">Mietrecht</option>
              <option value="arbeitsrecht">Arbeitsrecht</option>
              <option value="datenschutz">Datenschutz / DSGVO</option>
              <option value="vertragsrecht">Vertragsrecht</option>
              <option value="familienrecht">Familienrecht</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Beschreiben Sie Ihren Fall
            </label>
            <textarea
              rows={5}
              className={inputClass}
              placeholder="z.B. Mein Vermieter möchte die Miete um 15% erhöhen..."
              value={profile.case_description}
              onChange={(e) => update("case_description", e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-sm text-slate-500 disabled:opacity-30"
        >
          Zurück
        </button>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Gespeichert
            </span>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => {
                handleSave();
                setStep((s) => s + 1);
              }}
              className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-light"
            >
              Weiter <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-navy hover:bg-gold-light disabled:opacity-50"
            >
              {saving ? "Speichern..." : "Profil speichern"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
