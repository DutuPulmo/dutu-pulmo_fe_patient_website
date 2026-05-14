import React, { useState, useMemo } from "react";
import {
  CalendarDays, Clock, Video, MapPin,
  ChevronLeft, CheckCircle2, Star, Stethoscope, AlertCircle, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notifyBookingConfirmed } from "@/services/ai-chatbot.service";
import { usePublicDoctorDetail, useDoctorAvailableSlots } from "@/hooks/use-doctors";
import { useMyPatient } from "@/hooks/use-profile";
import { useCreateAppointment } from "@/hooks/use-appointments";
import type { TimeSlotResponse } from "@/services/doctor";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingData {
  doctorId: string;
  doctorName?: string;
  doctorSpecialty?: string;
  hospitalName?: string;
  doctorRating?: number;
  date?: string;
  slot?: string;
  type?: "VIDEO" | "IN_PERSON";
}

export interface ConfirmDetail {
  doctorId: string;
  doctorName: string;
  selectedDate: string;
  selectedSlot: string;
  visitType: "VIDEO" | "IN_PERSON";
}

interface BookingPanelProps {
  bookingData: BookingData;
  sessionId: string | null;
  onClose: () => void;
  onConfirm: (detail: ConfirmDetail, confirmMessage: string) => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  messageId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVietnamTime(dateString: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(dateString));
}

// ─── DoctorInfo ───────────────────────────────────────────────────────────────
function DoctorInfo({ data, doctorInfo }: { data: BookingData, doctorInfo?: any }) {
  const name = doctorInfo?.user?.fullName || data.doctorName || "Bác sĩ chuyên khoa";
  const spec = doctorInfo?.specialty || data.doctorSpecialty || "Hô hấp – Phổi";
  const hosp = doctorInfo?.primaryHospital?.name || data.hospitalName || "";
  const rating = doctorInfo?.averageRating || data.doctorRating;

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
      <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 overflow-hidden">
        {doctorInfo?.user?.avatarUrl ? (
          <img src={doctorInfo.user.avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <Stethoscope size={18} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {name}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {spec} {hosp && `· ${hosp}`}
          {rating ? (
            <span className="inline-flex items-center gap-0.5 ml-2 text-amber-500">
              <Star size={10} fill="currentColor" /> {rating}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

// ─── BookingPanel ─────────────────────────────────────────────────────────────
type Step = "select" | "confirm" | "submitting" | "success" | "error";

export const BookingPanel: React.FC<BookingPanelProps> = ({
  bookingData, sessionId, onConfirm, isMinimized = false, onToggleMinimize, messageId
}) => {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = d.toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "numeric" });
        return { value, label };
    });
  }, []);

  const [step, setStep] = useState<Step>("select");
  const [visitType, setVisitType] = useState<"VIDEO" | "IN_PERSON">(bookingData.type ?? "VIDEO");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const mappedAppointmentType = visitType === "VIDEO" ? "online" : "offline";

  // API Hooks
  const doctorQuery = usePublicDoctorDetail(bookingData.doctorId);
  const doctorInfo = doctorQuery.data;
  
  const myPatientQuery = useMyPatient();
  const createAppointmentMutation = useCreateAppointment();

  const slotsQuery = useDoctorAvailableSlots(
    bookingData.doctorId,
    selectedDate || undefined,
    mappedAppointmentType
  );

  const displayedSlots = useMemo(() => {
    if (!slotsQuery.data) return [];
    return slotsQuery.data.filter(slot => {
       const types = slot.allowedAppointmentTypes?.map(t => t.toUpperCase()) || [];
       if (visitType === "VIDEO") return types.includes("VIDEO");
       return types.includes("IN_CLINIC");
    });
  }, [slotsQuery.data, visitType]);

  const handleConfirm = async () => {
    setStep("submitting");
    setErrorMsg("");

    try {
      const patientId = myPatientQuery.data?.id;
      if (!patientId) throw new Error("Vui lòng đăng nhập với tư cách bệnh nhân để đặt lịch.");
      if (!doctorInfo?.primaryHospital?.id) throw new Error("Không tìm thấy thông tin bệnh viện của bác sĩ.");
      if (!selectedSlot) throw new Error("Chưa chọn giờ khám.");

      // Gọi API thực tạo lịch
      await createAppointmentMutation.mutateAsync({
        timeSlotId: selectedSlot.id,
        patientId,
        hospitalId: doctorInfo.primaryHospital.id,
        subType: 'SCHEDULED',
        sourceType: 'EXTERNAL',
        chiefComplaint: 'Khám theo AI tư vấn',
        symptoms: [],
        patientNotes: 'Đặt lịch qua AI Chatbot',
      });

      const slotDisplay = `${formatVietnamTime(selectedSlot.startTime)} - ${formatVietnamTime(selectedSlot.endTime)}`;
      
      const detail: ConfirmDetail = {
        doctorId: bookingData.doctorId,
        doctorName: doctorInfo?.fullName ?? bookingData.doctorName ?? "Bác sĩ",
        selectedDate,
        selectedSlot: slotDisplay,
        visitType,
      };

      // Báo n8n để lưu memory + lấy confirm message hiển thị trong chat
      const n8nRes = await notifyBookingConfirmed({
        ...detail,
        sessionId: sessionId ?? `session-${Date.now()}`,
        messageId,
      });

      setStep("success");
      setTimeout(() => {
        onConfirm(detail, n8nRes.data.message);
      }, 1800);

    } catch (err: any) {
      console.error("Booking confirm error:", err);
      const errorMessage =
        err?.response?.data?.message
          ? typeof err.response.data.message === 'string'
            ? err.response.data.message
            : err.response.data.message.message
          : err?.message || "Không thể xác nhận lịch. Vui lòng thử lại.";
      setErrorMsg(errorMessage);
      setStep("error");
    }
  };

  // Success
  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 animate-in fade-in duration-300">
        <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center text-green-600">
          <CheckCircle2 size={32} />
        </div>
        <p className="font-bold text-slate-800">Đặt lịch thành công!</p>
        <p className="text-xs text-slate-500 text-center">
          {doctorInfo?.fullName ?? bookingData.doctorName} · {selectedSlot ? `${formatVietnamTime(selectedSlot.startTime)}` : ''} · {selectedDate}
        </p>
      </div>
    );
  }

  // Error
  if (step === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 px-4 animate-in fade-in duration-300">
        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-500">
          <AlertCircle size={28} />
        </div>
        <p className="text-sm text-slate-700 text-center">{errorMsg}</p>
        <button onClick={() => setStep("confirm")} className="text-xs text-blue-600 font-semibold hover:underline">
          Thử lại
        </button>
      </div>
    );
  }

  // Confirm / Submitting
  if (step === "confirm" || step === "submitting") {
    const isSubmitting = step === "submitting";
    return (
      <div className="flex flex-col gap-4 p-4 animate-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => !isSubmitting && setStep("select")}
            disabled={isSubmitting}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 disabled:opacity-40"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="font-bold text-slate-800 text-sm">Xác nhận lịch khám</p>
        </div>

        <DoctorInfo data={bookingData} doctorInfo={doctorInfo} />

        <div className="rounded-xl border border-slate-100 bg-white divide-y divide-slate-50 overflow-hidden">
          {[
            { icon: <CalendarDays size={15} className="text-blue-500" />, label: "Ngày khám", value: selectedDate },
            { icon: <Clock size={15} className="text-blue-500" />, label: "Giờ khám", value: selectedSlot ? `${formatVietnamTime(selectedSlot.startTime)} - ${formatVietnamTime(selectedSlot.endTime)}` : '' },
            {
              icon: visitType === "VIDEO"
                ? <Video size={15} className="text-blue-500" />
                : <MapPin size={15} className="text-blue-500" />,
              label: "Hình thức",
              value: visitType === "VIDEO" ? "Video call" : "Trực tiếp",
            },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 text-slate-500 text-xs">{row.icon}{row.label}</div>
              <span className="text-xs font-semibold text-slate-800">{row.value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className={cn(
            "w-full py-3 rounded-xl text-sm font-bold text-white transition-all",
            isSubmitting
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-200"
          )}
        >
          {isSubmitting ? (
             <span className="flex items-center justify-center">
               <Loader2 className="animate-spin w-4 h-4 mr-2" /> Đang xác nhận...
             </span>
          ) : "Xác nhận đặt lịch"}
        </button>
      </div>
    );
  }

  // Select
  return (
    <div className="flex flex-col gap-3 p-4 animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center justify-between">
        <p className="font-bold text-slate-800 text-sm">Chọn lịch khám</p>
        <button 
          onClick={onToggleMinimize} 
          className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors flex items-center gap-1"
        >
          {isMinimized ? "Mở rộng ↓" : "Thu gọn ↑"}
        </button>
      </div>

      {!isMinimized && (
        <>
          <DoctorInfo data={bookingData} doctorInfo={doctorInfo} />

          {/* Visit type */}
          <div className="flex gap-2">
            {([
              { key: "VIDEO" as const, icon: <Video size={13} />, label: "Video call" },
              { key: "IN_PERSON" as const, icon: <MapPin size={13} />, label: "Trực tiếp" },
            ]).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => { setVisitType(key); setSelectedSlot(null); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all",
                  visitType === key
                    ? "border-blue-500 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                )}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Date */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-1">Chọn ngày</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {days.map((d, i) => {
                const active = selectedDate === d.value;
                return (
                  <button
                    key={i}
                    onClick={() => { setSelectedDate(d.value); setSelectedSlot(null); }}
                    className={cn(
                      "shrink-0 px-3 py-2 rounded-lg border text-xs font-medium transition-all whitespace-nowrap",
                      active
                        ? "border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slots */}
          {selectedDate && (
            <div className="animate-in fade-in duration-200 mt-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Chọn giờ</p>
              
              {slotsQuery.isLoading ? (
                <div className="flex items-center justify-center p-4 text-slate-400 text-xs">
                  <Loader2 className="animate-spin w-4 h-4 mr-2" /> Đang tải...
                </div>
              ) : displayedSlots.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {displayedSlots.map((s) => {
                    const isSelected = selectedSlot?.id === s.id;
                    const remaining = Math.max(s.capacity - s.bookedCount, 0);
                    const disabled = remaining === 0;

                    return (
                      <button
                        key={s.id}
                        onClick={() => !disabled && setSelectedSlot(s)}
                        disabled={disabled}
                        className={cn(
                          "py-2 px-1 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center justify-center",
                          isSelected
                            ? "border-blue-500 bg-blue-50 text-blue-600"
                            : disabled ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed" 
                            : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                        )}
                      >
                        <span>{formatVietnamTime(s.startTime)} - {formatVietnamTime(s.endTime)}</span>
                        <span className="text-[10px] font-normal opacity-70 mt-0.5">Còn {remaining} chỗ</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center p-4 text-xs text-slate-500 bg-slate-50 rounded-lg">
                    Không có lịch trống
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setStep("confirm")}
            disabled={!selectedDate || !selectedSlot}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-bold text-white mt-2 transition-all",
              selectedDate && selectedSlot
                ? "bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-200"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            Tiếp tục →
          </button>
        </>
      )}
    </div>
  );
};
