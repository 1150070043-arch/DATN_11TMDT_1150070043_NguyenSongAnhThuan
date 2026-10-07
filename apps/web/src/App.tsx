import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminRoute, ProtectedRoute } from "./components/RouteGuards";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { AdminPage } from "./pages/AdminPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ResetPasswordPage } from "./pages/PasswordRecoveryPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { VnpayReturnPage } from "./pages/VnpayReturnPage";
import * as Design from './design/Runtime';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <CartProvider>
          <Routes>
            <Route element={<Design.DesignLayout />}>
              <Route index element={<Design.Home />} />
              <Route path="catalog" element={<Design.Catalog />} />
              <Route path="books/:slug" element={<Design.Detail />} />
              <Route path="book/:slug" element={<Design.Detail />} />
              <Route path="login" element={<Design.Auth />} />
              <Route path="register" element={<Design.Auth register />} />
              <Route path="forgot-password" element={<Design.Forgot />} />
              <Route path="reset-password" element={<div className="legacy-ui reference-auth"><ResetPasswordPage /></div>} />
              <Route path="verify-email" element={<div className="legacy-ui reference-auth"><VerifyEmailPage /></div>} />
              <Route path="payment/vnpay-return" element={<VnpayReturnPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="cart" element={<Design.Cart />} />
                <Route path="wishlist" element={<Design.Wishlist />} />
                <Route path="checkout" element={<Design.Checkout />} />
                <Route path="confirmation/:id" element={<Design.Confirmation />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="profile" element={<Design.Settings />} />
              </Route>
              <Route element={<AdminRoute />}>
                <Route path="admin" element={<AdminPage />} />
              </Route>
              <Route path="*" element={<Design.NotFound />} />
            </Route>
          </Routes>
          </CartProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
