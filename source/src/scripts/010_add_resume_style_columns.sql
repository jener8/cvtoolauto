alter table resume_versions
add column if not exists profile_photo_border boolean default true;

alter table resume_versions
add column if not exists target_box_bg_color text;

alter table resume_versions
add column if not exists target_box_border_color text;