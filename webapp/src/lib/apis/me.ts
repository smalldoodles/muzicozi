import axios from 'axios';
import { Heart } from '../../../../shared/types';

export const getMyHearts = async () => {
  const res = await axios.get<Heart[]>(
    `${process.env.REACT_APP_SERVER_HOST}/me/hearts`,
    { withCredentials: true }
  );
  return res.data;
};