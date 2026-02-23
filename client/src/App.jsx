import { Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Profile } from './pages/Profile';
import { ShopDetail } from './pages/ShopDetail';
import { PlaceDetail } from './pages/PlaceDetail';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="search" element={<Landing />} />
        <Route path="shop/:shopId" element={<ShopDetail />} />
        <Route path="place/:placeId" element={<PlaceDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}
