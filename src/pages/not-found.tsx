import { Card, CardContent } from '@/components/ui/card';
import { Activity, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="app-grid min-h-[100dvh] w-full bg-[#f4f3ec] flex items-center justify-center px-5">
      <Card className="w-full max-w-md mx-4 border-[#cbd8ce] bg-[#f9f8f2] shadow-[0_18px_40px_rgba(37,65,60,.08)]">
        <CardContent className="pt-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#183f42] text-[#b7dd4c]"><Activity size={18} /></div>
            <span className="font-mono-signal text-[10px] uppercase tracking-[.16em] text-[#71817d]">signal lost</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-.04em] text-[#19363b]">That route is outside the readout.</h1>
          <p className="mt-3 text-sm leading-6 text-[#60716e]">RepoPulse only has one surface: the repository report. Return to the instrument and choose a repository.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0b6d67] px-3 py-2 text-xs font-medium text-[#f5f5e9] hover:bg-[#075b57]" data-testid="link-return-home"><ArrowLeft size={14} /> Return to RepoPulse</Link>
        </CardContent>
      </Card>
    </div>
  );
}
