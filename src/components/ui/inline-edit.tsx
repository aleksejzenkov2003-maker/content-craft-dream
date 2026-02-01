import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { format, parseISO, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type InlineEditType = "text" | "date" | "datetime" | "select";

export interface SelectOption {
  value: string;
  label: string;
}

export interface InlineEditProps {
  type: InlineEditType;
  value: string | null | undefined;
  onSave: (value: string) => void | Promise<void>;
  options?: SelectOption[];
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  disabled?: boolean;
  formatDisplay?: (value: string | null | undefined) => string;
}

export function InlineEdit({
  type,
  value,
  onSave,
  options = [],
  placeholder = "—",
  className,
  displayClassName,
  disabled = false,
  formatDisplay,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedHour, setSelectedHour] = useState("12");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value || "");
    // Parse time from value if datetime
    if (value && type === "datetime") {
      try {
        const date = parseISO(value);
        setSelectedHour(format(date, "HH"));
        setSelectedMinute(format(date, "mm"));
      } catch {
        setSelectedHour("12");
        setSelectedMinute("00");
      }
    }
  }, [value, type]);

  useEffect(() => {
    if (isEditing && inputRef.current && type === "text") {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, type]);

  const handleSave = useCallback(async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(value || "");
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  const getDisplayValue = useCallback(() => {
    if (formatDisplay) {
      return formatDisplay(value);
    }

    if (!value) return placeholder;

    if (type === "date" || type === "datetime") {
      try {
        const date = parseISO(value);
        return type === "datetime"
          ? format(date, "dd.MM.yyyy HH:mm", { locale: ru })
          : format(date, "dd.MM.yyyy", { locale: ru });
      } catch {
        return value;
      }
    }

    if (type === "select") {
      const option = options.find((o) => o.value === value);
      return option?.label || value;
    }

    return value;
  }, [value, type, options, placeholder, formatDisplay]);

  if (disabled) {
    return (
      <span className={cn("text-muted-foreground", displayClassName)}>
        {getDisplayValue()}
      </span>
    );
  }

  // Hours and minutes options
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  // Date/datetime picker mode
  if ((type === "date" || type === "datetime") && isEditing) {
    const handleDateSelect = (date: Date | undefined) => {
      if (date) {
        let finalDate = date;
        if (type === "datetime") {
          finalDate = setMinutes(setHours(date, parseInt(selectedHour)), parseInt(selectedMinute));
        }
        const isoDate = finalDate.toISOString();
        setEditValue(isoDate);
        if (type === "date") {
          onSave(isoDate);
          setIsEditing(false);
        }
      }
    };

    const handleTimeConfirm = () => {
      if (editValue) {
        try {
          let date = parseISO(editValue);
          date = setMinutes(setHours(date, parseInt(selectedHour)), parseInt(selectedMinute));
          const isoDate = date.toISOString();
          onSave(isoDate);
          setIsEditing(false);
        } catch {
          setIsEditing(false);
        }
      } else {
        setIsEditing(false);
      }
    };

    return (
      <Popover open={isEditing} onOpenChange={(open) => !open && handleCancel()}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="xs"
            className={cn(
              "justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-3 w-3" />
            {getDisplayValue()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={editValue ? parseISO(editValue) : undefined}
            onSelect={handleDateSelect}
            initialFocus
            className="p-3 pointer-events-auto"
            locale={ru}
          />
          {type === "datetime" && (
            <div className="border-t p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Время:</span>
                <Select value={selectedHour} onValueChange={setSelectedHour}>
                  <SelectTrigger className="w-16 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>:</span>
                <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                  <SelectTrigger className="w-16 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minutes.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  Отмена
                </Button>
                <Button size="sm" onClick={handleTimeConfirm}>
                  Применить
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // Select mode
  if (type === "select" && isEditing) {
    return (
      <Select
        value={editValue}
        onValueChange={(val) => {
          const previousValue = value;
          setEditValue(val);
          setIsEditing(false);
          // Only save if value actually changed, with a small delay to let UI settle
          if (val !== previousValue) {
            requestAnimationFrame(() => {
              onSave(val);
            });
          }
        }}
        defaultOpen={true}
        onOpenChange={(open) => {
          if (!open) {
            setIsEditing(false);
          }
        }}
      >
        <SelectTrigger className={cn("h-7 text-xs", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="z-50">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Text input mode
  if (type === "text" && isEditing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isSaving}
          className="h-7 text-xs"
        />
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Check className="h-3 w-3 text-success" />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  // Display mode
  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        "text-left hover:bg-accent/50 px-1.5 py-0.5 rounded transition-colors cursor-pointer",
        !value && "text-muted-foreground",
        displayClassName
      )}
    >
      {getDisplayValue()}
    </button>
  );
}
