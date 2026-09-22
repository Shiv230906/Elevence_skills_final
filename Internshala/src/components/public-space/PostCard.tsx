import React, { useState } from "react";
import { useSelector } from "react-redux";
import { selectuser } from "@/feature/userSlice";
import { useTranslation } from "react-i18next";
import { Heart, Share2, Trash2, MoreHorizontal, Copy, ExternalLink } from "lucide-react";
import { toast } from "react-toastify";
import Link from "next/link";
import CommentSection from "./CommentSection";

import { BACKEND_URL } from "@/config/api";

interface Post {
  _id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  userEmail: string;
  content: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  likes: string[];
  comments: any[];
  shares: number;
  createdAt: string;
}

interface PostCardProps {
  post: Post;
  onDeleted?: (postId: string) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const PostCard: React.FC<PostCardProps> = ({ post, onDeleted }) => {
  const { t } = useTranslation();
  const user = useSelector(selectuser);
  const [likes, setLikes] = useState<string[]>(post.likes || []);
  const [shares, setShares] = useState(post.shares || 0);
  const [commentCount, setCommentCount] = useState(post.comments?.length || 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  const isLiked = user?.uid ? likes.includes(user.uid) : false;
  const isOwner = user?.uid === post.userId;
  const postUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/public-space/post/${post._id}`;

  const handleLike = async () => {
    if (!user) {
      toast.error(t("publicSpace.loginRequired"));
      return;
    }
    if (likeLoading) return;
    setLikeLoading(true);

    // Optimistic update
    const wasLiked = likes.includes(user.uid!);
    setLikes((prev) =>
      wasLiked ? prev.filter((id) => id !== user.uid) : [...prev, user.uid!]
    );

    try {
      const res = await fetch(`${BACKEND_URL}/api/posts/${post._id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLikes(data.likes);
      } else {
        // Revert
        setLikes((prev) =>
          wasLiked ? [...prev, user.uid!] : prev.filter((id) => id !== user.uid)
        );
        toast.error(t("publicSpace.likeFailed"));
      }
    } catch {
      // Revert
      setLikes((prev) =>
        wasLiked ? [...prev, user.uid!] : prev.filter((id) => id !== user.uid)
      );
      toast.error(t("publicSpace.likeFailed"));
    } finally {
      setLikeLoading(false);
    }
  };

  const handleShare = async () => {
    setShowShareMenu(false);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.userName}`,
          text: post.content,
          url: postUrl,
        });
      } else {
        await navigator.clipboard.writeText(postUrl);
        toast.success(t("publicSpace.linkCopied"));
      }
      // Increment share count on backend
      const res = await fetch(`${BACKEND_URL}/api/posts/${post._id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.uid }),
      });
      const data = await res.json();
      if (res.ok) setShares(data.shares);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        await navigator.clipboard.writeText(postUrl).catch(() => {});
        toast.success(t("publicSpace.linkCopied"));
      }
    }
  };

  const handleCopyLink = async () => {
    setShowShareMenu(false);
    try {
      await navigator.clipboard.writeText(postUrl);
      toast.success(t("publicSpace.linkCopied"));
    } catch {
      toast.error("Unable to copy link.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("publicSpace.confirmDelete"))) return;
    setShowMenu(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/posts/${post._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.uid }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t("publicSpace.postDeleted"));
        onDeleted?.(post._id);
      } else {
        toast.error(data.error || t("publicSpace.deleteFailed"));
      }
    } catch {
      toast.error(t("publicSpace.deleteFailed"));
    }
  };

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <img
            src={post.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.userName || "U")}`}
            alt={post.userName}
            className="w-10 h-10 rounded-full object-cover border border-gray-200"
          />
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">{post.userName || "Anonymous"}</p>
            <p className="text-xs text-gray-400">{timeAgo(post.createdAt)}</p>
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[140px] py-1">
              <Link
                href={`/public-space/post/${post._id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowMenu(false)}
              >
                <ExternalLink size={14} />
                View post
              </Link>
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Copy size={14} />
                {t("publicSpace.copyLink")}
              </button>
              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  {t("publicSpace.deletePost")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-5 pb-3">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Media */}
      {post.mediaUrl && (
        <div className="px-5 pb-3">
          {post.mediaType === "image" ? (
            <img
              src={post.mediaUrl}
              alt="Post media"
              className="w-full rounded-xl object-cover max-h-[500px] bg-gray-100"
              loading="lazy"
            />
          ) : post.mediaType === "video" ? (
            <video
              src={post.mediaUrl}
              controls
              className="w-full rounded-xl max-h-[500px]"
            />
          ) : null}
        </div>
      )}

      {/* Stats Bar */}
      <div className="px-5 py-2 flex items-center justify-between text-xs text-gray-400 border-t border-gray-50">
        <span>{likes.length > 0 ? `${likes.length} ${likes.length === 1 ? "like" : "likes"}` : ""}</span>
        <span>
          {commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? "" : "s"}` : ""}
          {shares > 0 ? `  ·  ${shares} share${shares === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      {/* Action Bar */}
      <div className="px-5 pb-2 flex items-center gap-1 border-t border-gray-100">
        {/* Like */}
        <button
          onClick={handleLike}
          disabled={likeLoading}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
            isLiked
              ? "text-red-500 bg-red-50 hover:bg-red-100"
              : "text-gray-500 hover:bg-gray-50 hover:text-red-500"
          }`}
        >
          <Heart
            size={17}
            className={isLiked ? "fill-red-500" : ""}
          />
          {isLiked ? t("publicSpace.liked") : t("publicSpace.like")}
        </button>

        {/* Comment */}
        <button
          onClick={() => setCommentsOpen((prev) => !prev)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-blue-500 transition-colors"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {t("publicSpace.comment")}
        </button>

        {/* Share */}
        <div className="flex-1 relative">
          <button
            onClick={() => setShowShareMenu((prev) => !prev)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-green-600 transition-colors"
          >
            <Share2 size={17} />
            {t("publicSpace.share")}
          </button>
          {showShareMenu && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[160px] py-1">
              <button
                onClick={handleShare}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Share2 size={14} />
                {t("publicSpace.sharePost")}
              </button>
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Copy size={14} />
                {t("publicSpace.copyLink")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comment Section */}
      <CommentSection
        postId={post._id}
        initialComments={post.comments || []}
        isOpen={commentsOpen}
        onToggle={() => setCommentsOpen((prev) => !prev)}
        onCommentCountChange={setCommentCount}
      />
    </article>
  );
};

export default PostCard;
