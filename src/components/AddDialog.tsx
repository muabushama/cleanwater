import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X } from 'lucide-react';

export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'file';
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
  accept?: string;
}

interface AddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: Field[];
  onSubmit: (data: Record<string, string>, files?: Record<string, File>) => Promise<void>;
  loading?: boolean;
  initialValues?: Record<string, string>;
}

export function AddDialog({ open, onOpenChange, title, fields, onSubmit, loading, initialValues }: AddDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    fields.forEach(f => { if (f.type !== 'file') init[f.name] = f.defaultValue || ''; });
    return init;
  });

  useEffect(() => {
    if (open) {
      if (initialValues) {
        setValues(prev => ({ ...prev, ...initialValues }));
      } else {
        const init: Record<string, string> = {};
        fields.forEach(f => { if (f.type !== 'file') init[f.name] = f.defaultValue || ''; });
        setValues(init);
      }
    }
  }, [open, initialValues]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileChange = (fieldName: string, file: File | null) => {
    if (file) {
      setFiles(prev => ({ ...prev, [fieldName]: file }));
      const url = URL.createObjectURL(file);
      setPreviews(prev => ({ ...prev, [fieldName]: url }));
    } else {
      setFiles(prev => { const n = { ...prev }; delete n[fieldName]; return n; });
      setPreviews(prev => { const n = { ...prev }; delete n[fieldName]; return n; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values, Object.keys(files).length > 0 ? files : undefined);
    // Reset
    const init: Record<string, string> = {};
    fields.forEach(f => { if (f.type !== 'file') init[f.name] = f.defaultValue || ''; });
    setValues(init);
    setFiles({});
    setPreviews({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(field => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.type === 'file' ? (
                <div className="space-y-2">
                  {previews[field.name] && (
                    <div className="relative w-24 h-24">
                      <img src={previews[field.name]} alt="preview" className="w-24 h-24 object-cover rounded-lg border" />
                      <button type="button" onClick={() => handleFileChange(field.name, null)} className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={el => { fileInputRefs.current[field.name] = el; }}
                    accept={field.accept || 'image/*'}
                    className="hidden"
                    onChange={e => handleFileChange(field.name, e.target.files?.[0] || null)}
                  />
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileInputRefs.current[field.name]?.click()}>
                    <Upload className="h-4 w-4" /> {files[field.name] ? 'تغيير الصورة' : 'رفع صورة'}
                  </Button>
                </div>
              ) : field.type === 'textarea' ? (
                <Textarea
                  id={field.name}
                  value={values[field.name] || ''}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  required={field.required}
                />
              ) : field.type === 'select' ? (
                <Select value={values[field.name]} onValueChange={v => setValues(prev => ({ ...prev, [field.name]: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {field.options?.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.name}
                  type={field.type || 'text'}
                  value={values[field.name] || ''}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  required={field.required}
                  dir={field.type === 'number' ? 'ltr' : undefined}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={loading}>{loading ? 'جاري الحفظ...' : 'حفظ'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
