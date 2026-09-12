'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, HelpCircle } from 'lucide-react';

type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface AlertOptions {
  title?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  buttonText?: string;
}

interface ConfirmOptions {
  title?: string;
  type?: 'warning' | 'error' | 'info';
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'destructive' | 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
}

interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  confirmVariant: 'destructive' | 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface DialogContextType {
  showAlert: (message: string, options?: AlertOptions) => Promise<void>;
  showConfirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    type: 'info',
    title: '',
    description: '',
    confirmText: 'OK',
    cancelText: 'Batal',
    confirmVariant: 'default',
  });

  const showAlert = useCallback(
    (message: string, options?: AlertOptions): Promise<void> => {
      return new Promise((resolve) => {
        const type = options?.type || 'info';
        const defaultTitle =
          type === 'error'
            ? 'Terjadi Kesalahan'
            : type === 'warning'
            ? 'Peringatan'
            : type === 'success'
            ? 'Berhasil'
            : 'Informasi';

        setDialogState({
          isOpen: true,
          type,
          title: options?.title || defaultTitle,
          description: message,
          confirmText: options?.buttonText || 'Mengerti',
          cancelText: '',
          confirmVariant: type === 'error' ? 'destructive' : 'default',
          onConfirm: () => {
            setDialogState((prev) => ({ ...prev, isOpen: false }));
            resolve();
          },
        });
      });
    },
    []
  );

  const showConfirm = useCallback(
    (message: string, options?: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        const type = options?.type || 'warning';
        const defaultTitle =
          type === 'error'
            ? 'Konfirmasi Tindakan Bahaya'
            : type === 'warning'
            ? 'Konfirmasi Tindakan'
            : 'Konfirmasi';

        setDialogState({
          isOpen: true,
          type: 'confirm',
          title: options?.title || defaultTitle,
          description: message,
          confirmText: options?.confirmText || 'Ya, Lanjutkan',
          cancelText: options?.cancelText || 'Batal',
          confirmVariant:
            options?.confirmVariant || (type === 'error' ? 'destructive' : 'default'),
          onConfirm: () => {
            setDialogState((prev) => ({ ...prev, isOpen: false }));
            resolve(true);
          },
          onCancel: () => {
            setDialogState((prev) => ({ ...prev, isOpen: false }));
            resolve(false);
          },
        });
      });
    },
    []
  );

  const getIcon = () => {
    switch (dialogState.type) {
      case 'error':
        return (
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 dark:text-red-400">
            <AlertCircle className="w-6 h-6" />
          </div>
        );
      case 'warning':
        return (
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        );
      case 'success':
        return (
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        );
      case 'confirm':
        return (
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[#002446] dark:text-blue-300">
            <HelpCircle className="w-6 h-6" />
          </div>
        );
      default:
        return (
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[#002446] dark:text-blue-300">
            <Info className="w-6 h-6" />
          </div>
        );
    }
  };

  const isConfirm = dialogState.type === 'confirm';

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      <Dialog
        open={dialogState.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (isConfirm && dialogState.onCancel) {
              dialogState.onCancel();
            } else if (dialogState.onConfirm) {
              dialogState.onConfirm();
            } else {
              setDialogState((prev) => ({ ...prev, isOpen: false }));
            }
          }
        }}
      >
        <DialogContent className="max-w-md p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center sm:text-center">
          <DialogHeader className="space-y-3 sm:text-center">
            {getIcon()}
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
              {dialogState.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {dialogState.description}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 justify-center sm:justify-center">
            {isConfirm && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  dialogState.onCancel?.();
                }}
                className="w-full sm:w-1/2"
              >
                {dialogState.cancelText}
              </Button>
            )}
            <Button
              type="button"
              variant={dialogState.confirmVariant}
              onClick={() => {
                dialogState.onConfirm?.();
              }}
              className={`w-full ${isConfirm ? 'sm:w-1/2' : 'sm:w-full'} ${
                dialogState.confirmVariant === 'default'
                  ? 'bg-[#002446] hover:bg-[#002446]/90 text-white font-medium'
                  : ''
              }`}
            >
              {dialogState.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
