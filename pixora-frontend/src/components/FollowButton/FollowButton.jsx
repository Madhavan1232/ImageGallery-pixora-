import { useEffect, useState } from 'react';
import { userAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function FollowButton({ targetUserId }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    userAPI.getFollowing().then(res => {
      if (!mounted) return;
      const followingList = res.data.following || [];
      setFollowing(followingList.includes(targetUserId));
    }).catch(() => {});
    return () => { mounted = false; };
  }, [user, targetUserId]);

  const toggle = async (e) => {
    e && e.stopPropagation();
    if (!user) return toast.error('Sign in to follow users');
    setLoading(true);
    try {
      const res = await userAPI.toggleFollow(targetUserId);
      setFollowing(res.data?.following || res.following || !following);
      toast.success(res.data?.following ? 'Following' : 'Unfollowed');
    } catch (err) {
      console.error('Follow failed', err);
      toast.error('Failed to update follow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button className={`btn ${following ? 'btn-secondary' : 'btn-primary'}`} onClick={toggle} disabled={loading}>
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
