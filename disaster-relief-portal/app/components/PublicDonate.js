'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Copy, CreditCard, Heart, IndianRupee, Landmark, QrCode, ShieldCheck, Smartphone, Sparkles, Timer, Users, Building2, Wallet } from 'lucide-react';

function formatINR(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '₹0';
  const parts = num.toFixed(0).split('');
  const lastThree = parts.splice(-3).join('');
  const rest = parts.join('');
  const formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree : lastThree;
  return '₹' + formatted;
}

const presetAmounts = [100, 500, 1000, 2500, 5000, 10000];

const upiId = 'disasterrelief@okhdfcbank';
const upiName = 'IMPACTSTER';

const upiApps = [
  { name: 'Google Pay', color: '#4285F4', icon: 'G' },
  { name: 'PhonePe', color: '#5F259F', icon: 'P' },
  { name: 'Paytm', color: '#00B9F1', icon: '₹' },
  { name: 'BHIM', color: '#FF7A30', icon: 'B' },
];

const banks = [
  { name: 'State Bank of India', short: 'SBI', popular: true },
  { name: 'HDFC Bank', short: 'HDFC', popular: true },
  { name: 'ICICI Bank', short: 'ICICI', popular: true },
  { name: 'Axis Bank', short: 'AXIS', popular: true },
  { name: 'Punjab National Bank', short: 'PNB' },
  { name: 'Bank of Baroda', short: 'BOB' },
  { name: 'Canara Bank', short: 'CANARA' },
  { name: 'Union Bank of India', short: 'UBI' },
  { name: 'Kotak Mahindra Bank', short: 'KOTAK' },
];

export default function PublicDonate() {
  const [step, setStep] = useState('form');
  const [payMethod, setPayMethod] = useState('upi');
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedUpiApp, setSelectedUpiApp] = useState('');
  const [error, setError] = useState('');
  const [donationRef, setDonationRef] = useState('');
  const [copied, setCopied] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [qrTimer, setQrTimer] = useState(300);

  const timerRef = useRef(null);

  const effectiveAmount = amount === 'custom' ? customAmount : amount;

  useEffect(() => {
    if (payMethod === 'upi' && step === 'form') {
      setQrTimer(300);
      timerRef.current = setInterval(() => setQrTimer(t => t > 0 ? t - 1 : 0), 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [payMethod, step]);

  function formatTimer(s) { const m = Math.floor(s/60); const sec = s%60; return `${m}:${sec.toString().padStart(2,'0')}`; }

  function selectAmount(val) { setAmount(String(val)); setCustomAmount(''); }
  function copyUpiId() { navigator.clipboard?.writeText(upiId); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  function detectCardType(num) {
    const n = num.replace(/\s/g, '');
    if (/^4/.test(n)) return { name: 'Visa', color: '#1A1F71' };
    if (/^5[1-5]/.test(n)) return { name: 'Mastercard', color: '#EB001B' };
    if (/^3[47]/.test(n)) return { name: 'Amex', color: '#2E77BC' };
    return null;
  }
  const cardType = detectCardType(cardNumber);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const amt = Number(effectiveAmount);
    if (!amt || amt <= 0) { setError('Please select or enter a donation amount.'); return; }
    if (!donorName.trim()) { setError('Please enter your name.'); return; }
    setStep('processing');
    await new Promise(r => setTimeout(r, 2200));
    try {
      const res = await fetch('/api/donations/financial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donor_name: donorName.trim(), donor_email: donorEmail.trim() || null, donor_phone: donorPhone.trim() || null, amount: amt, currency: 'INR', payment_method: payMethod, transaction_id: 'TXN' + Date.now().toString(36).toUpperCase(), purpose: purpose.trim() || 'Flood Relief Donation', status: 'completed' })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      const created = await res.json();
      setDonationRef(`DON-${created.id}-${Date.now().toString(36).toUpperCase()}`);
      window.dispatchEvent(new CustomEvent('data:changed'));
      setStep('success');
    } catch (e) { setError(e.message); setStep('form'); }
  }

  function resetForm() {
    setStep('form'); setAmount(''); setCustomAmount(''); setDonorName(''); setDonorEmail('');
    setDonorPhone(''); setPurpose(''); setCardNumber(''); setCardExpiry(''); setCardCvv('');
    setCardName(''); setSelectedBank(''); setSelectedUpiApp(''); setError(''); setDonationRef('');
  }

  // ═══════════════ SUCCESS ═══════════════
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(16,185,129,0.08), transparent), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(14,165,233,0.04), transparent), #F8FAFC' }}>
        <div className="w-full max-w-md animate-scale-in">
          <div className="rounded-[24px] bg-white border border-[#E2E8F0]/60 p-8 shadow-[0_8px_40px_-8px_rgba(15,23,42,0.12)] text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#10B981] to-[#34D399] shadow-lg shadow-emerald-500/25 mb-6 animate-glow-pulse">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-[-0.03em] text-[#0F172A] mb-2">Thank You! 🎉</h1>
            <p className="text-[#64748B] text-sm leading-relaxed mb-2">
              Your donation of <span className="font-bold text-[#10B981]">{formatINR(Number(effectiveAmount))}</span> via <span className="font-semibold capitalize">{payMethod === 'netbanking' ? 'Net Banking' : payMethod === 'upi' ? 'UPI' : 'Card'}</span> was successful.
            </p>
            <p className="text-[#64748B] text-xs mb-6">Every contribution brings hope to families affected by the floods.</p>
            <div className="rounded-2xl bg-[#F0FDF4] border border-[#10B981]/20 p-4 mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B] mb-1">Reference ID</p>
              <p className="text-sm font-mono font-bold text-[#0F172A] tracking-wider">{donationRef}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={resetForm} className="rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#FF9A5A] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-orange-500/20 hover:shadow-lg hover:brightness-105 transition-all">Donate Again</button>
              <button onClick={() => window.open('/donations', '_self')} className="rounded-xl bg-white border border-[#E2E8F0] px-6 py-3 text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-all">View Donations</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════ PROCESSING ═══════════════
  if (step === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(255,122,48,0.06), transparent), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(14,165,233,0.04), transparent), #F8FAFC' }}>
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="rounded-[24px] bg-white border border-[#E2E8F0]/60 p-8 shadow-[0_8px_40px_-8px_rgba(15,23,42,0.1)] text-center">
            {payMethod === 'upi' && (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#5F259F] to-[#8B5CF6] shadow-lg shadow-purple-500/25 mb-6">
                <Smartphone className="h-8 w-8 text-white animate-pulse" />
              </div>
            )}
            {payMethod === 'card' && (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#1E293B] to-[#475569] shadow-lg shadow-slate-500/25 mb-6">
                <CreditCard className="h-8 w-8 text-white animate-pulse" />
              </div>
            )}
            {payMethod === 'netbanking' && (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#38BDF8] shadow-lg shadow-sky-500/25 mb-6">
                <Building2 className="h-8 w-8 text-white animate-pulse" />
              </div>
            )}
            <h1 className="text-xl font-black tracking-[-0.03em] text-[#0F172A] mb-2">Processing Payment</h1>
            <p className="text-[#64748B] text-sm mb-1">Please wait while we process your donation of {formatINR(Number(effectiveAmount))}...</p>
            <p className="text-[11px] text-[#94A3B8] mb-6">Do not close this page</p>
            <div className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden mb-4">
              <div className="h-full rounded-full bg-gradient-to-r from-[#FF7A30] to-[#FF9A5A]" style={{ animation: 'slideRight 1.8s ease-in-out infinite' }} />
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-[#94A3B8]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
              Secure transaction · 256-bit encrypted
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════ MAIN FORM ═══════════════
  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(255,122,48,0.07), transparent), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(14,165,233,0.04), transparent), radial-gradient(ellipse 50% 40% at 0% 80%, rgba(16,185,129,0.03), transparent), #F8FAFC' }}>
      <div className="mx-auto max-w-2xl">
        {/* Hero */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF7A30]/8 border border-[#FF7A30]/15 px-3 py-1 mb-4">
            <Heart className="h-3 w-3 text-[#FF7A30]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF7A30]">Support Relief Efforts</span>
          </div>
          <h1 className="text-[34px] sm:text-[42px] font-black tracking-[-0.04em] text-[#0F172A] leading-[1.08]">
            Make a <span className="bg-gradient-to-r from-[#FF7A30] to-[#FF9A5A] bg-clip-text text-transparent">Difference</span>
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-[#64748B] max-w-md mx-auto">
            Your donation provides food, shelter, medicine, and hope to families affected by the floods.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-center">
            <div><p className="text-xl font-black text-[#10B981]">₹90K+</p><p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Raised</p></div>
            <div className="h-8 w-px bg-[#E2E8F0]" />
            <div><p className="text-xl font-black text-[#0EA5E9]">4+</p><p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Donors</p></div>
            <div className="h-8 w-px bg-[#E2E8F0]" />
            <div><p className="text-xl font-black text-[#FF7A30]">50+</p><p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Families Helped</p></div>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-[24px] bg-white border border-[#E2E8F0]/60 shadow-[0_8px_40px_-8px_rgba(15,23,42,0.1)] overflow-hidden animate-fade-in-up">
          {/* Payment method tabs */}
          <div className="flex border-b border-[#E2E8F0]/60 bg-[#F8FAFC]/50">
            {[
              { id: 'upi', label: 'UPI / QR', icon: QrCode, desc: 'Google Pay, PhonePe, Paytm' },
              { id: 'card', label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, Amex' },
              { id: 'netbanking', label: 'Net Banking', icon: Landmark, desc: '50+ banks supported' },
            ].map((m) => (
              <button key={m.id} onClick={() => { setPayMethod(m.id); setSelectedBank(''); setSelectedUpiApp(''); }}
                className={`flex-1 flex flex-col items-center gap-1 py-4 px-2 text-center transition-all duration-200 border-b-2 ${
                  payMethod === m.id ? 'border-[#FF7A30] bg-white' : 'border-transparent hover:bg-[#F8FAFC]'
                }`}
              >
                <m.icon className={`h-5 w-5 ${payMethod === m.id ? 'text-[#FF7A30]' : 'text-[#94A3B8]'}`} />
                <span className={`text-xs font-bold ${payMethod === m.id ? 'text-[#FF7A30]' : 'text-[#64748B]'}`}>{m.label}</span>
                <span className="text-[9px] text-[#94A3B8] hidden sm:block">{m.desc}</span>
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit}>
              {/* ── Amount Selection ── */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-[#0F172A] mb-3">Select Amount</label>
                <div className="grid grid-cols-3 gap-2.5 mb-3">
                  {presetAmounts.map((val) => (
                    <button key={val} type="button" onClick={() => selectAmount(val)}
                      className={`rounded-xl border-2 py-3 text-sm font-bold transition-all duration-200 ${
                        amount === String(val) ? 'border-[#FF7A30] bg-[#FFF7ED] text-[#FF7A30] shadow-[0_0_0_4px_rgba(255,122,48,0.1)]' : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-[#FF7A30]/40 hover:bg-[#FFF7ED]/50'
                      }`}>{formatINR(val)}</button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] font-bold text-sm">₹</span>
                  <input type="number" placeholder="Enter custom amount" value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setAmount('custom'); }} onFocus={() => setAmount('custom')}
                    className={`w-full h-[52px] rounded-xl border-2 pl-10 pr-4 text-sm font-semibold text-[#0F172A] outline-none transition-all duration-200 ${
                      amount === 'custom' ? 'border-[#FF7A30] bg-[#FFF7ED] shadow-[0_0_0_4px_rgba(255,122,48,0.1)]' : 'border-[#E2E8F0] bg-[#F8FAFC] focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20'
                    }`} />
                </div>
                {effectiveAmount && Number(effectiveAmount) > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#FFF7ED] border border-[#FF7A30]/20 px-4 py-3">
                    <IndianRupee className="h-4 w-4 text-[#FF7A30]" />
                    <span className="text-sm font-bold text-[#FF7A30]">You&apos;re donating {formatINR(Number(effectiveAmount))}</span>
                  </div>
                )}
              </div>

              {/* ═══════════════ UPI PAYMENT PORTAL ═══════════════ */}
              {payMethod === 'upi' && (
                <div className="mb-8 rounded-2xl bg-gradient-to-br from-[#F8FAFC] via-[#F0F9FF] to-[#FFF7ED] border border-[#E2E8F0]/60 p-6">
                  <div className="text-center mb-5">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#E2E8F0] px-4 py-1.5 mb-3">
                      <QrCode className="h-3.5 w-3.5 text-[#FF7A30]" />
                      <span className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">Scan & Pay with any UPI App</span>
                    </div>
                    {effectiveAmount && Number(effectiveAmount) > 0 && (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[28px] font-black text-[#0F172A]">{formatINR(Number(effectiveAmount))}</span>
                        <span className="flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          <Timer className="h-3 w-3" />{formatTimer(qrTimer)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* QR + UPI Apps side by side */}
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* QR Code */}
                    <div className="shrink-0 rounded-2xl bg-white border-2 border-dashed border-[#FF7A30]/30 p-5 relative shadow-sm">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF7A30] text-white rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-wider">Scan Me</div>
                      <div className="w-[160px] h-[160px] grid grid-cols-8 gap-[2px] p-1">
                        {Array.from({ length: 64 }).map((_, i) => {
                          const row = Math.floor(i/8), col = i%8;
                          const isFinder = (row<3&&col<3)||(row<3&&col>4)||(row>4&&col<3);
                          const isTiming = (row===3&&col%2===0)||(col===3&&row%2===0);
                          const isDark = isFinder ? !(row===1&&col===1)&&!(row===1&&col===6)&&!(row===6&&col===1) : isTiming ? true : ((row*8+col*7+13)%3!==0);
                          return <div key={i} className={`rounded-[2px] ${isDark?'bg-[#0F172A]':'bg-transparent'}`} />;
                        })}
                      </div>
                      <p className="text-center text-[9px] font-semibold text-[#94A3B8] mt-2">QR expires in {formatTimer(qrTimer)}</p>
                    </div>

                    {/* UPI Apps + UPI ID */}
                    <div className="flex-1 space-y-4">
                      <p className="text-xs font-semibold text-[#475569]">Pay with your favorite UPI app:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {upiApps.map((app) => (
                          <button key={app.name} type="button"
                            onClick={() => setSelectedUpiApp(app.name)}
                            className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 transition-all duration-200 ${
                              selectedUpiApp === app.name ? 'border-[#FF7A30] bg-white shadow-[0_0_0_4px_rgba(255,122,48,0.1)]' : 'border-[#E2E8F0] bg-white hover:border-[#FF7A30]/40'
                            }`}>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white" style={{ background: app.color }}>{app.icon}</div>
                            <span className="text-[9px] font-semibold text-[#475569] leading-tight">{app.name}</span>
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Or pay to UPI ID</p>
                        <div className="flex items-center gap-2 rounded-xl bg-white border border-[#E2E8F0] px-4 py-3">
                          <span className="text-sm font-mono font-bold text-[#0F172A] flex-1 select-all">{upiId}</span>
                          <button type="button" onClick={copyUpiId}
                            className={`rounded-lg p-2 transition-all ${copied ? 'bg-[#10B981]/10 text-[#10B981]' : 'text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569]'}`}>
                            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#64748B]">Pay to: <span className="font-semibold">{upiName}</span></p>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════ CARD PAYMENT PORTAL ═══════════════ */}
              {payMethod === 'card' && (
                <div className="mb-8 space-y-4">
                  {/* Virtual Card Preview */}
                  <div className="relative h-[200px] perspective-[1000px] cursor-pointer" onClick={() => setCardFlipped(!cardFlipped)}>
                    <div className={`relative w-full h-full transition-transform duration-700 ${cardFlipped ? '[transform:rotateY(180deg)]' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
                      {/* Front */}
                      <div className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between text-white" style={{
                        background: cardType ? `linear-gradient(135deg, ${cardType.color}, ${cardType.color}dd)` : 'linear-gradient(135deg, #1E293B, #0F172A)',
                        backfaceVisibility: 'hidden'
                      }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{cardType?.name || 'Bank'}</span>
                          <CreditCard className="h-5 w-5 opacity-80" />
                        </div>
                        <div>
                          <p className="font-mono text-xl tracking-[0.15em] font-bold mb-4">{cardNumber || '•••• •••• •••• ••••'}</p>
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[8px] uppercase tracking-[0.15em] opacity-60 mb-0.5">Cardholder</p>
                              <p className="text-xs font-bold uppercase tracking-wider">{cardName || 'YOUR NAME'}</p>
                            </div>
                            <div>
                              <p className="text-[8px] uppercase tracking-[0.15em] opacity-60 mb-0.5">Expires</p>
                              <p className="text-xs font-mono font-bold">{cardExpiry || 'MM/YY'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Back */}
                      <div className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between text-white"
                        style={{ background: 'linear-gradient(135deg, #334155, #1E293B)', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                        <div className="h-10 bg-[#0F172A] mt-4 -mx-6" />
                        <div className="flex justify-end">
                          <div className="bg-white/10 rounded-lg px-3 py-1.5">
                            <p className="text-[8px] uppercase tracking-[0.15em] opacity-60 mb-0.5">CVV</p>
                            <p className="text-sm font-mono font-bold tracking-[0.3em]">{cardCvv || '•••'}</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-center opacity-50 mt-2">Click card to flip back</p>
                      </div>
                    </div>
                  </div>

                  {/* Card Form */}
                  <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/60 p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex -space-x-2">
                        {['#1A1F71','#EB001B','#2E77BC'].map((c,i) => <div key={i} className="h-6 w-9 rounded border border-white bg-white flex items-center justify-center text-[8px] font-black" style={{color:c}}>{['VISA','MC','AMEX'][i]}</div>)}
                      </div>
                      <span className="text-[10px] font-semibold text-[#94A3B8]">Accepted cards</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748B] mb-1.5">Card Number</label>
                      <div className="relative">
                        <input type="text" maxLength={19} placeholder="1234 5678 9012 3456" value={cardNumber}
                          onChange={(e) => { let v=e.target.value.replace(/\D/g,'').slice(0,16); v=v.replace(/(\d{4})(?=\d)/g,'$1 '); setCardNumber(v); }}
                          className="w-full h-[46px] rounded-xl border border-[#E2E8F0] bg-white px-4 pr-12 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 transition-all font-mono tracking-wider" />
                        {cardType && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black" style={{color:cardType.color}}>{cardType.name}</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748B] mb-1.5">Expiry Date</label>
                        <input type="text" maxLength={5} placeholder="MM / YY" value={cardExpiry}
                          onChange={(e) => { let v=e.target.value.replace(/\D/g,'').slice(0,4); if(v.length>2) v=v.slice(0,2)+' / '+v.slice(2); setCardExpiry(v); }}
                          className="w-full h-[46px] rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 transition-all font-mono" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748B] mb-1.5">CVV / CVC</label>
                        <input type="password" maxLength={3} placeholder="•••" value={cardCvv} onFocus={() => setCardFlipped(true)} onBlur={() => setCardFlipped(false)}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g,'').slice(0,3))}
                          className="w-full h-[46px] rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 transition-all font-mono tracking-widest" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748B] mb-1.5">Cardholder Name</label>
                      <input type="text" placeholder="Name as on card" value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())}
                        className="w-full h-[46px] rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 transition-all uppercase tracking-wider" />
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-[#E2E8F0]/60">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
                      <span className="text-[10px] text-[#94A3B8] font-medium">256-bit SSL encrypted · PCI DSS compliant · No card data stored</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════ NET BANKING PORTAL ═══════════════ */}
              {payMethod === 'netbanking' && (
                <div className="mb-8 rounded-2xl bg-gradient-to-br from-[#F0F9FF] to-[#F8FAFC] border border-[#E2E8F0]/60 p-6">
                  <div className="text-center mb-5">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#E2E8F0] px-4 py-1.5 mb-2">
                      <Building2 className="h-3.5 w-3.5 text-[#0EA5E9]" />
                      <span className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">Select Your Bank</span>
                    </div>
                    <p className="text-xs text-[#64748B]">You will be redirected to your bank&apos;s secure portal to complete the payment.</p>
                  </div>

                  {/* Popular banks */}
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8] mb-2">Popular Banks</p>
                    <div className="grid grid-cols-2 gap-2">
                      {banks.filter(b=>b.popular).map((bank) => (
                        <button key={bank.name} type="button" onClick={() => setSelectedBank(bank.name)}
                          className={`flex items-center gap-3 rounded-xl border-2 p-3.5 transition-all duration-200 text-left ${
                            selectedBank === bank.name ? 'border-[#0EA5E9] bg-white shadow-[0_0_0_4px_rgba(14,165,233,0.1)]' : 'border-[#E2E8F0] bg-white hover:border-[#0EA5E9]/40 hover:bg-[#F0F9FF]/50'
                          }`}>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9]/10 to-[#38BDF8]/10 text-[#0EA5E9] text-[10px] font-black">{bank.short}</div>
                          <div>
                            <p className="text-xs font-bold text-[#0F172A]">{bank.name}</p>
                            <p className="text-[9px] text-[#94A3B8]">Net Banking</p>
                          </div>
                          {selectedBank === bank.name && <CheckCircle2 className="ml-auto h-4 w-4 text-[#0EA5E9]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Other banks */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8] mb-2">Other Banks</p>
                    <div className="grid grid-cols-3 gap-2">
                      {banks.filter(b=>!b.popular).map((bank) => (
                        <button key={bank.name} type="button" onClick={() => setSelectedBank(bank.name)}
                          className={`rounded-xl border-2 p-2.5 text-center transition-all duration-200 ${
                            selectedBank === bank.name ? 'border-[#0EA5E9] bg-white shadow-[0_0_0_4px_rgba(14,165,233,0.1)]' : 'border-[#E2E8F0] bg-white hover:border-[#0EA5E9]/40'
                          }`}>
                          <p className="text-[10px] font-semibold text-[#475569] leading-tight">{bank.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedBank && (
                    <div className="mt-4 rounded-xl bg-[#0EA5E9]/5 border border-[#0EA5E9]/20 p-3 text-center">
                      <CheckCircle2 className="h-4 w-4 text-[#0EA5E9] mx-auto mb-1" />
                      <p className="text-xs font-semibold text-[#0EA5E9]">You&apos;ll be redirected to <span className="font-bold">{selectedBank}</span>&apos;s secure payment gateway after clicking Complete Donation.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Donor Info ── */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#64748B]" /> Your Details
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="Full Name *"
                    className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
                  <input type="email" value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} placeholder="Email Address"
                    className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
                  <input type="tel" value={donorPhone} onChange={(e) => setDonorPhone(e.target.value)} placeholder="Phone Number"
                    className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
                  <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose (e.g., Food, Medicine)"
                    className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
                </div>
              </div>

              {/* Error */}
              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2 mb-4">⚠️ {error}</div>}

              {/* Submit */}
              <button type="submit"
                className="w-full flex items-center justify-center gap-2 h-[54px] rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#FF9A5A] text-base font-bold text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:brightness-105 transition-all duration-200 active:scale-[0.98]">
                <Wallet className="h-5 w-5" />
                Pay {effectiveAmount ? formatINR(Number(effectiveAmount)) : '—'} via {payMethod === 'upi' ? 'UPI' : payMethod === 'card' ? 'Card' : 'Net Banking'}
              </button>

              <p className="text-center text-[11px] text-[#94A3B8] mt-4 flex items-center justify-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-[#10B981]" /> Secure & encrypted · This is a demo payment portal
              </p>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-[11px] text-[#94A3B8] animate-fade-in-up">
          <p>Disaster Relief Coordination Portal · IMPACTSTER Command Desk</p>
          <p className="mt-0.5">For queries: relief@disasterresponse.org | 80G tax-exempt donations</p>
        </div>
      </div>
    </div>
  );
}

