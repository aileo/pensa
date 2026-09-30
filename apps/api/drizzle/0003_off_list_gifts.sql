ALTER TABLE "wishes" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wishes" ALTER COLUMN "image" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wishes" ADD COLUMN "off_list" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wishes" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;