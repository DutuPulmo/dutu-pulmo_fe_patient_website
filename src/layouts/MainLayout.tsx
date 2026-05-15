import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { AIChatBubble } from "../components/chat/AIChatBubble";
import { SocketHandler } from "../components/chat/SocketHandler";

function MainLayout() {
  return (
    <>
      <SocketHandler />
      <Header />

      <Outlet />

      <AIChatBubble />

      <Footer />
    </>
  );
}

export default MainLayout;
