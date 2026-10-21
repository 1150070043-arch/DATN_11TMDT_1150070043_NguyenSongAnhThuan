import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminRoute, ProtectedRoute } from "./components/RouteGuards";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { AsyncState } from "./components/AsyncState";
import * as Design from './design/Runtime';

const AdminPage = lazy(() => import("./pages/AdminPage").then(module => ({ default: module.AdminPage })));
const OrdersPage = lazy(() => import("./pages/OrdersPage").then(module => ({ default: module.OrdersPage })));
const ResetPasswordPage = lazy(() => import("./pages/PasswordRecoveryPage").then(module => ({ default: module.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage").then(module => ({ default: module.VerifyEmailPage })));
const VnpayReturnPage = lazy(() => import("./pages/VnpayReturnPage").then(module => ({ default: module.VnpayReturnPage })));
const Auth = lazy(() => import("./design/AccountRuntime").then(module => ({ default: module.Auth })));
const Forgot = lazy(() => import("./design/AccountRuntime").then(module => ({ default: module.Forgot })));
const Settings = lazy(() => import("./design/AccountRuntime").then(module => ({ default: module.Settings })));
const Cart = lazy(() => import("./design/PurchaseRuntime").then(module => ({ default: module.Cart })));
const Wishlist = lazy(() => import("./design/PurchaseRuntime").then(module => ({ default: module.Wishlist })));
const Checkout = lazy(() => import("./design/PurchaseRuntime").then(module => ({ default: module.Checkout })));
const Confirmation = lazy(() => import("./design/PurchaseRuntime").then(module => ({ default: module.Confirmation })));
const AboutPage = lazy(() => import("./design/BrandPages").then(module => ({ default: module.AboutPage })));
const ContactPage = lazy(() => import("./design/BrandPages").then(module => ({ default: module.ContactPage })));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <CartProvider>
          <Suspense fallback={<AsyncState label="Đang mở trang…" />}><Routes>
            <Route element={<Design.DesignLayout />}>
              <Route index element={<Design.Home />} />
              <Route path="catalog" element={<Design.Catalog />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="books/:slug" element={<Design.Detail />} />
              <Route path="book/:slug" element={<Design.Detail />} />
              <Route path="login" element={<Auth />} />
              <Route path="register" element={<Auth register />} />
              <Route path="forgot-password" element={<Forgot />} />
              <Route path="reset-password" element={<div className="legacy-ui reference-auth"><ResetPasswordPage /></div>} />
              <Route path="verify-email" element={<div className="legacy-ui reference-auth"><VerifyEmailPage /></div>} />
              <Route path="payment/vnpay-return" element={<VnpayReturnPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="cart" element={<Cart />} />
                <Route path="wishlist" element={<Wishlist />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="confirmation/:id" element={<Confirmation />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="profile" element={<Settings />} />
              </Route>
              <Route element={<AdminRoute />}>
                <Route path="admin" element={<AdminPage />} />
              </Route>
              <Route path="*" element={<Design.NotFound />} />
            </Route>
          </Routes></Suspense>
          </CartProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
