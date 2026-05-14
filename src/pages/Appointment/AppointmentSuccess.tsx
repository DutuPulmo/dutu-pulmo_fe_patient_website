import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';

import type { Doctor } from '@/types/doctor';
import type { UserProfile } from '@/types/user';
import type { TimeSlot } from '@/components/appointment/TimeSlotSection';
import PaymentTotalCard from '@/components/appointment/appointmentsuccess/PaymentTotalCard';
import PaymentMethodList from '@/components/appointment/appointmentsuccess/PaymentMethodList';
import PaymentSecurityNotice from '@/components/appointment/appointmentsuccess/PaymentSecurityNotice';
import { useCreatePayment } from '@/hooks/use-payment';

interface AppointmentResponse {
  id: string;
}

interface AppointmentSuccessState {
  appointment?: AppointmentResponse;
  doctor: Doctor;
  user: UserProfile;
  selectedDate: string;
  selectedSlot: TimeSlot;
}

function AppointmentSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as AppointmentSuccessState | null;
  const [loading, setLoading] = useState(false);
  const createPaymentMutation = useCreatePayment();

  if (!state) {
    return (
      <main className="flex-grow py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-red-500">Không có dữ liệu thanh toán.</p>
        </div>
      </main>
    );
  }

  const { selectedSlot, appointment } = state;

  const handlePayNow = async () => {
    try {
      setLoading(true);

      const appointmentId = appointment?.id;
      if (!appointmentId) {
        toast.error('Không tìm thấy appointmentId.');
        navigate('/appointments');
        return;
      }

      const payment = await createPaymentMutation.mutateAsync(appointmentId);
      const checkoutUrl = payment?.checkoutUrl;

      if (!checkoutUrl) {
        throw new Error('Không nhận được checkoutUrl từ hệ thống.');
      }

      localStorage.setItem('payment_success_context', JSON.stringify(state));
      localStorage.setItem('currentAppointmentId', appointmentId);

      window.location.href = checkoutUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error && (error as any).response?.data?.message
          ? typeof (error as any).response.data.message === 'string'
            ? (error as any).response.data.message
            : (error as any).response.data.message.message
          : error instanceof Error
            ? error.message
            : 'Có lỗi xảy ra khi tạo thanh toán';
      console.error(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-grow py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <PaymentTotalCard selectedSlot={selectedSlot} />

        <PaymentMethodList />

        <PaymentSecurityNotice />
        
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
          <span className="material-icons text-amber-500 mt-0.5">timer</span>
          <div>
            <h4 className="font-bold text-amber-900 text-sm">Lưu ý giữ chỗ</h4>
            <p className="text-amber-800 text-sm mt-1 leading-relaxed">
              Bạn vui lòng hoàn tất thanh toán trong vòng **24 giờ** kể từ khi đặt. Sau thời gian này, hệ thống sẽ tự động hủy lịch để nhường chỗ cho bệnh nhân khác.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePayNow}
          disabled={loading}
          className="w-full mt-8 py-4 bg-primary text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-600 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Đang tạo link thanh toán...' : 'Thanh toán ngay'}
          {!loading && <span className="material-icons">arrow_forward</span>}
        </button>
      </div>
    </main>
  );
}

export default AppointmentSuccess;

