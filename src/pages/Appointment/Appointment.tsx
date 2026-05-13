import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import AdditionalInfoSection from "@/components/appointment/AdditionalInfoSection";
import AppointmentBreadcrumb from "@/components/appointment/AppointmentBreadcrumb";
import AppointmentSteps from "@/components/appointment/AppointmentSteps";
import AppointmentTypeSection from "@/components/appointment/AppointmentTypeSection";
import CalendarSection from "@/components/appointment/CalendarSection";
import ContinueButton from "@/components/appointment/ContinueButton";
import DoctorCard from "@/components/appointment/DoctorCard";
import PatientProfileCard from "@/components/appointment/PatientProfileCard";
import TimeSlotSection, {
  type TimeSlot,
} from "@/components/appointment/TimeSlotSection";
import { usePublicDoctorDetail } from "@/hooks/use-doctors";
import { useMyPatient } from "@/hooks/use-profile";
import type { Doctor } from "@/types/doctor";

function Appointment() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as any;
  const doctorId = (state?.doctorId as string | undefined) || searchParams.get('doctorId') || undefined;

  const doctorQuery = usePublicDoctorDetail(doctorId);
  const myPatientQuery = useMyPatient();

  const doctor = (doctorQuery.data as Doctor | null) ?? null;
  const user = myPatientQuery.data?.user ?? null;

  const [selectedDate, setSelectedDate] = useState<string | null>(state?.selectedDate || null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(state?.selectedSlotId || null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(state?.selectedSlot || null);
  const [appointmentType, setAppointmentType] = useState<"all" | "online" | "offline">(state?.appointmentType || "all");
  const [chiefComplaint, setChiefComplaint] = useState(state?.chiefComplaint || "");
  const [symptomsInput, setSymptomsInput] = useState(state?.symptomsInput || "");
  const [patientNotesHtml, setPatientNotesHtml] = useState(state?.patientNotesHtml || "");
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(!!(state?.chiefComplaint || state?.symptomsInput || state?.patientNotesHtml));

  useEffect(() => {
    if (!doctorId) {
      toast.error("Vui lòng chọn bác sĩ trước khi đặt lịch.");
      navigate("/doctor", { replace: true });
      return;
    }

    if (!doctorQuery.isLoading && !doctorQuery.data) {
      toast.error("Không tìm thấy thông tin bác sĩ.");
      navigate("/doctor", { replace: true });
    }
  }, [doctorId, navigate, doctorQuery.isLoading, doctorQuery.data]);


  const handleChangeAppointmentType = (value: "all" | "online" | "offline") => {
    setAppointmentType(value);
    setSelectedSlotId(null);
    setSelectedSlot(null);
  };

  const handleContinue = () => {
    if (!selectedDate || !selectedSlotId) {
      toast.warning("Vui lòng chọn đầy đủ ngày và giờ khám");
      return;
    }

    navigate("/appointment-confirm", {
      state: {
        doctor,
        user,
        selectedDate,
        selectedSlotId,
        selectedSlot,
        appointmentType,
        chiefComplaint,
        symptomsInput,
        patientNotesHtml,
      },
    });
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 w-full flex-grow">
      <AppointmentBreadcrumb />
      <h1 className="text-2xl font-bold mb-8">Đặt lịch khám</h1>

      <AppointmentSteps currentStep={1} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-4 space-y-6">
          <DoctorCard doctor={doctor} />
          <PatientProfileCard user={user} />
        </aside>

        <div className="lg:col-span-8 space-y-6">
          {doctorId && (
            <AppointmentTypeSection
              value={appointmentType}
              onChange={handleChangeAppointmentType}
            />
          )}

          {doctorId && (
            <CalendarSection
              doctorId={doctorId}
              selectedDate={selectedDate}
              appointmentType={appointmentType}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setSelectedSlotId(null);
                setSelectedSlot(null);
              }}
            />
          )}

          {doctorId && (
            <TimeSlotSection
              doctorId={doctorId}
              selectedDate={selectedDate}
              appointmentType={appointmentType}
              selectedSlotId={selectedSlotId}
              onSelectSlot={(slot) => {
                setSelectedSlotId(slot.id);
                setSelectedSlot(slot);
              }}
            />
          )}

          {!showAdditionalInfo ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center space-x-2 mb-6">
                <span className="material-icons text-primary">info</span>
                <h4 className="font-bold">
                  Thông tin bổ sung (không bắt buộc)
                </h4>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-8 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
                  Bạn có thể cung cấp thêm các thông tin như lý do khám, triệu
                  chứng, đơn thuốc sử dụng gần đây.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAdditionalInfo(true)}
                  className="text-primary font-bold text-sm flex items-center justify-center mx-auto hover:underline"
                >
                  Tôi muốn gửi thêm thông tin
                  <span className="material-icons ml-1 text-sm">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <AdditionalInfoSection
                chiefComplaint={chiefComplaint}
                symptoms={symptomsInput}
                patientNotes={patientNotesHtml}
                onChiefComplaintChange={setChiefComplaint}
                onSymptomsChange={setSymptomsInput}
                onPatientNotesChange={setPatientNotesHtml}
              />
              <button
                type="button"
                onClick={() => setShowAdditionalInfo(false)}
                className="text-primary font-bold text-sm flex items-center justify-center mx-auto hover:underline"
              >
                Thu gọn
              </button>
            </div>
          )}

          <ContinueButton
            onClick={handleContinue}
            disabled={!selectedDate || !selectedSlotId}
          />
        </div>
      </div>
    </main>
  );
}

export default Appointment;
