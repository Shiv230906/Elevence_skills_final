import React, { useState, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { selectuser } from "@/feature/userSlice";
import { useTranslation } from "react-i18next";
import { Image, Video, X, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

const BACKEND_URL = "http://localhost:5000";

interface PostPermission {
  canPost: boolean;
  unlimited: boolean;
  remaining: number | string;
  dailyLimit: number | string;
  todayCount: number;
  friendCount: number;
}

interface PostComposerProps {
  permission: PostPermission | null;
  onPostCreated: (post: any) => void;
}

const PostComposer: React.FC<PostComposerProps> = ({ permission, onPostCreated }) => {
  const { t } = useTranslation();
  const user = useSelector(selectuser);
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleMediaSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (50 MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 50 MB.");
      return;
    }

    setMediaFile(file);
    setMediaType(type);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }, []);

  const removeMedia = useCallback(() => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
  }, [mediaPreview]);

  const handlePost = async () => {
    if (!user) {
      toast.error(t("publicSpace.loginRequired"));
      return;
    }
    if (!content.trim() && !mediaFile) {
      toast.error("Please write something or upload media.");
      return;
    }

    setIsPosting(true);
    try {
      const formData = new FormData();
      formData.append("userId", user.uid || "");
      formData.append("userName", user.name || "");
      formData.append("userPhoto", user.photo || "");
      formData.append("userEmail", user.email || "");
      formData.append("content", content.trim());
      if (mediaFile) {
        formData.append("media", mediaFile);
      }

      const res = await fetch(`${BACKEND_URL}/api/posts`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "NO_FRIENDS") {
          toast.error(t("publicSpace.noFriends"));
        } else if (data.code === "LIMIT_REACHED") {
          toast.error(t("publicSpace.limitReached"));
        } else {
          toast.error(data.error || t("publicSpace.postFailed"));
        }
        return;
      }

      toast.success("Post published!");
      setContent("");
      removeMedia();
      onPostCreated(data.post);
    } catch (err) {
      console.error("[PostComposer] Error creating post:", err);
      toast.error(t("publicSpace.postFailed"));
    } finally {
      setIsPosting(false);
    }
  };

  if (!user) return null;

  const canPost = permission?.canPost ?? false;
  const unlimited = permission?.unlimited ?? false;
  const remaining = permission?.remaining;
  const friendCount = permission?.friendCount ?? 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
      {/* Posting Limit Banner */}
      {permission !== null && (
        <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm font-medium flex items-center justify-between ${
          friendCount === 0
            ? "bg-red-50 text-red-700 border border-red-200"
            : unlimited
            ? "bg-green-50 text-green-700 border border-green-200"
            : remaining === 0
            ? "bg-orange-50 text-orange-700 border border-orange-200"
            : "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          <span>
            {friendCount === 0
              ? t("publicSpace.noFriends")
              : unlimited
              ? `✨ ${t("publicSpace.unlimited")}`
              : remaining === 0
              ? t("publicSpace.limitReached")
              : `📝 ${t("publicSpace.postsRemaining")}: ${remaining}`}
          </span>
          {permission && !unlimited && friendCount > 0 && (
            <span className="text-xs opacity-70">{permission.todayCount}/{permission.dailyLimit} used</span>
          )}
        </div>
      )}

      {/* User Avatar + Textarea */}
      <div className="flex items-start gap-3">
        <img
          src={user.photo || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.name || "U")}
          alt={user.name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-200"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("publicSpace.whatsOnYourMind")}
          rows={3}
          disabled={!canPost}
          className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
        />
      </div>

      {/* Media Preview */}
      {mediaPreview && (
        <div className="mt-3 relative inline-block">
          {mediaType === "image" ? (
            <img
              src={mediaPreview}
              alt={t("publicSpace.mediaPreview")}
              className="max-h-64 rounded-xl object-cover border border-gray-200"
            />
          ) : (
            <video
              src={mediaPreview}
              controls
              className="max-h-64 rounded-xl border border-gray-200"
            />
          )}
          <button
            onClick={removeMedia}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
            title={t("publicSpace.removeMedia")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Actions Bar */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Image Upload */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleMediaSelect(e, "image")}
          />
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={!canPost || !!mediaFile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Image size={16} />
            {t("publicSpace.photo")}
          </button>

          {/* Video Upload */}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            className="hidden"
            onChange={(e) => handleMediaSelect(e, "video")}
          />
          <button
            onClick={() => videoInputRef.current?.click()}
            disabled={!canPost || !!mediaFile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-purple-600 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Video size={16} />
            {t("publicSpace.video")}
          </button>
        </div>

        {/* Post Button */}
        <button
          onClick={handlePost}
          disabled={isPosting || !canPost || (!content.trim() && !mediaFile)}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPosting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t("publicSpace.posting")}
            </>
          ) : (
            t("publicSpace.post")
          )}
        </button>
      </div>
    </div>
  );
};

export default PostComposer;
