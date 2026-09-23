'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { School, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { getUserSchools, switchActiveSchool } from '@/lib/actions/school';

interface SchoolItem {
  id: string;
  name: string;
  code: string;
}

export function SchoolSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [canSwitch, setCanSwitch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await getUserSchools();
        if (mounted) {
          setSchools(res.schools);
          setCurrentSchoolId(res.currentSchoolId);
          setCanSwitch(res.canSwitch);
        }
      } catch (err) {
        console.error('Failed to load user schools:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading || schools.length === 0) {
    return null;
  }

  const isBusy = switching || isPending;
  const currentSchool = schools.find((s) => s.id === currentSchoolId) || schools[0];

  const handleSelect = async (schoolId: string) => {
    if (schoolId === currentSchoolId || isBusy) return;
    try {
      setSwitching(true);
      setCurrentSchoolId(schoolId);
      await switchActiveSchool(schoolId);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error('Failed to switch school:', err);
    } finally {
      setSwitching(false);
    }
  };

  if (!canSwitch) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={currentSchool?.name}>
        <School className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
        <span className="truncate">{currentSchool?.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isBusy}
          className="flex items-center gap-2 h-9 px-2.5 border-brand-200 dark:border-brand-900 bg-brand-50/60 dark:bg-brand-950/40 text-brand-950 dark:text-brand-100 hover:bg-brand-100/60 dark:hover:bg-brand-900/60 text-xs font-semibold max-w-[280px] sm:max-w-[340px] transition-colors"
          title={`Sekolah Aktif: ${currentSchool?.name}`}
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
          ) : (
            <School className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
          )}
          <span className="truncate">{currentSchool?.name}</span>
          <ChevronsUpDown className="h-3 w-3 text-gray-400 shrink-0 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="text-xs text-gray-500 font-normal">
          Pilih Sekolah / Unit Kerja
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {schools.map((school) => {
          const isSelected = school.id === currentSchoolId;
          return (
            <DropdownMenuItem
              key={school.id}
              onClick={() => handleSelect(school.id)}
              className="flex items-center justify-between text-xs py-2 cursor-pointer font-medium"
            >
              <div className="flex flex-col gap-0.5 truncate pr-2">
                <span className="truncate font-semibold text-gray-900 dark:text-white">
                  {school.name}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  Kode: {school.code}
                </span>
              </div>
              {isSelected && <Check className="h-4 w-4 text-brand-600 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
