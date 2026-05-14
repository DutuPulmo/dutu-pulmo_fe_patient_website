import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { getAppointmentStatusConfig, getAppointmentTypeLabel } from '@/constants/appointment-status';
import type { AppointmentResponse } from '@/services/appointment.service';
import { useCheckInVideoCall } from '@/hooks/use-appointments';

type AppointmentCardProps = {
  appointment: AppointmentResponse;
};

function formatDateTime(date?: string) {
  if (!date) return '---';
  return new Date(date).toLocaleString('vi-VN');
}

function AppointmentCard({ appointment }: AppointmentCardProps) {
  const navigate = useNavigate();
  const statusConfig = getAppointmentStatusConfig(appointment.status);
  const hospitalName = appointment.hospital?.name || 'Đang cập nhật cơ sở';
  const isPendingPayment = appointment.status === 'PENDING_PAYMENT';

  const checkInMutation = useCheckInVideoCall();

  const handleNavigate = () => {
    // Only navigate to detail if we aren't currently waiting for check-in on this card
    if (!checkInMutation.isPending) {
        navigate(`/appointment-schedule/${appointment.id}`);
    }
  };

  return (
    <article
      className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition cursor-pointer"
      onClick={handleNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleNavigate();
        }
      }}
    >
      {/* Thanh nhắc nhở PENDING_PAYMENT - thêm mới */}
      {isPendingPayment && (
        <div className="mb-4 -mx-5 -mt-5 px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between gap-3 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-base">payments</span>
            <p className="text-xs font-semibold text-amber-700">
              Lịch khám chưa thanh toán (Hết hạn sau 24h)
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/payment?appointmentId=${appointment.id}`);
            }}
            className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
          >
            Thanh toán ngay
          </button>
        </div>
      )}

      <div className="flex justify-between items-start gap-3">
        <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass}`}>
          <span className="material-symbols-outlined text-sm">{statusConfig.icon}</span>
          <span>{statusConfig.label}</span>
        </div>
        <span className="text-xs text-slate-400">#{appointment.appointmentNumber || appointment.id}</span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0">
          {appointment.doctor?.avatarUrl ? (
            <img src={appointment.doctor.avatarUrl} alt={appointment.doctor.fullName || 'Bác sĩ'} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-slate-400">person</span>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 line-clamp-1">{appointment.doctor?.fullName || 'Chưa có bác sĩ'}</h3>
          <p className="text-sm text-slate-500 line-clamp-1">{appointment.doctor?.specialty || 'Chưa có chuyên khoa'}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-start gap-2 text-slate-500">
          <span className="material-symbols-outlined text-base mt-0.5">location_on</span>
          <span className="line-clamp-1">{hospitalName}</span>
        </div>
        <div className="flex items-start gap-2 text-slate-500">
          <span className="material-symbols-outlined text-base mt-0.5">calendar_today</span>
          <span>{formatDateTime(appointment.scheduledAt)}</span>
        </div>
        <div className="flex items-start gap-2 text-slate-500">
          <span className="material-symbols-outlined text-base mt-0.5">local_hospital</span>
          <span>{getAppointmentTypeLabel(appointment.appointmentType)}</span>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleNavigate();
          }}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
        >
          Xem chi tiết
        </button>

        {/* Nút thanh toán trong action row - thêm mới */}
        {isPendingPayment && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/payment?appointmentId=${appointment.id}`);
            }}
            className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 py-2.5 text-white font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">payments</span>
            Thanh toán
          </button>
        )}

        {appointment.appointmentType === 'VIDEO' && ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(appointment.status) && (
          <button
            type="button"
            disabled={checkInMutation.isPending}
            onClick={async (event) => {
              event.stopPropagation();
              try {
                // Chỉ gọi check-in nếu chưa điểm danh (status === 'CONFIRMED')
                if (appointment.status === 'CONFIRMED') {
                  await checkInMutation.mutateAsync(appointment.id);
                }
                navigate(`/video-call/${appointment.id}`);
              } catch (error: any) {
                const errorMsg = error?.response?.data?.message || error?.message || 'Không thể tham gia phòng video';
                toast.error(errorMsg);
              }
            }}
            className={`flex-1 rounded-xl py-2.5 text-white font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm ${
              checkInMutation.isPending ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {checkInMutation.isPending ? (
              <span className="material-symbols-outlined text-sm animate-spin">hourglass_empty</span>
            ) : (
              <span className="material-symbols-outlined text-sm">video_call</span>
            )}
            {checkInMutation.isPending 
              ? 'Đang chuẩn bị...' 
              : appointment.status === 'CONFIRMED' 
                ? 'Điểm danh & Vào khám' 
                : 'Vào phòng khám'}
          </button>
        )}
      </div>
    </article>
  );
}

export default AppointmentCard;
