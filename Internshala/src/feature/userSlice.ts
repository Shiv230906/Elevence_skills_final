import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  user: {
    uid?: string;
    name: string;
    email: string;
    photo?: string;
  } | null;
  isAdmin: boolean;
}

const initialState: UserState = {
  user: null,
  isAdmin: false,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<UserState['user']>) => {
      state.user = action.payload;
      state.isAdmin = false;
    },
    adminLogin: (state) => {
      state.user = null;
      state.isAdmin = true;
    },
    logout: (state) => {
      state.user = null;
      state.isAdmin = false;
    },
  },
});

export const { login, adminLogin, logout } = userSlice.actions;

export const selectuser = (state: { user: UserState }) => state.user.user;
export const selectisAdmin = (state: { user: UserState }) => state.user.isAdmin;

export default userSlice.reducer;
