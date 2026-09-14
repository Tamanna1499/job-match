CREATE TABLE "candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"skills" text[] NOT NULL,
	"years_of_experience" double precision NOT NULL,
	"location" text NOT NULL,
	"expected_salary_lpa" double precision NOT NULL,
	CONSTRAINT "candidates_experience_non_negative" CHECK ("candidates"."years_of_experience" >= 0),
	CONSTRAINT "candidates_salary_positive" CHECK ("candidates"."expected_salary_lpa" > 0)
);
--> statement-breakpoint
CREATE TABLE "job_required_skills" (
	"job_id" text NOT NULL,
	"skill" text NOT NULL,
	"must_have" boolean NOT NULL,
	CONSTRAINT "job_required_skills_job_id_skill_pk" PRIMARY KEY("job_id","skill")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"min_years_experience" double precision NOT NULL,
	"location" text NOT NULL,
	"salary_min_lpa" double precision NOT NULL,
	"salary_max_lpa" double precision NOT NULL,
	"remote_allowed" boolean NOT NULL,
	CONSTRAINT "jobs_experience_non_negative" CHECK ("jobs"."min_years_experience" >= 0),
	CONSTRAINT "jobs_salary_positive" CHECK ("jobs"."salary_min_lpa" > 0),
	CONSTRAINT "jobs_salary_range_ordered" CHECK ("jobs"."salary_max_lpa" >= "jobs"."salary_min_lpa")
);
--> statement-breakpoint
ALTER TABLE "job_required_skills" ADD CONSTRAINT "job_required_skills_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;