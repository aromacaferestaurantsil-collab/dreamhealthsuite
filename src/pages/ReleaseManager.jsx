import { useMemo, useState } from 'react';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import FilePicker from '@/components/FilePicker';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export const route = { path: '/releases', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'PackageCheck', label: 'Release manager', order: 6, profiles: ['Admin_c'] };

const FIELDS = [
  'Name', 'product_c', 'platform_c', 'version_c', 'build_number_c',
  'package_type_c', 'package_url_c', 'store_url_c', 'release_notes_c',
  'minimum_os_c', 'release_status_c', 'published_at_c', 'checksum_sha256_c',
  'file_size_mb_c', 'is_mandatory_c', 'is_latest_c', 'package_file_c'
];

const PRODUCTS = ['PharmaSuite', 'LabSuite', 'DoctorSuite', 'PatientSuite', 'CareConnect', 'HealthAnalytics', 'HealthSuite 360'];
const PLATFORMS = ['Android', 'iOS', 'Windows', 'macOS', 'Web'];
const PACKAGE_TYPES = ['Play Store', 'App Store', 'APK', 'AAB', 'Windows Installer', 'macOS Installer', 'Web App'];
const EMPTY = {
  product_c: 'PharmaSuite',
  platform_c: 'Android',
  version_c: '',
  build_number_c: '',
  package_type_c: 'Play Store',
  package_url_c: '',
  store_url_c: '',
  release_notes_c: '',
  minimum_os_c: '',
  release_status_c: 'Draft',
  checksum_sha256_c: '',
  file_size_mb_c: '',
  is_mandatory_c: false,
  is_latest_c: true,
  package_file_c: []
};

function fileArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default function ReleaseManager() {
  const { profile } = useProfile();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('All');
  const releases = useFetch(() => sdk.table('software_releases_c')
    .select(FIELDS)
    .orderByDesc('CreatedOn')
    .limit(300)
    .fetch()
    .then(result => {
      if (!result.success) throw new Error(result.message || 'Unable to load software releases');
      return result.data || [];
    }), []);

  const rows = releases.data || [];
  const visible = useMemo(() => filter === 'All' ? rows : rows.filter(row => row.product_c === filter), [rows, filter]);

  function setField(name, value) {
    setForm(current => ({ ...current, [name]: value }));
  }

  function editRelease(row) {
    setEditingId(row.Id);
    setForm({
      ...EMPTY,
      ...row,
      build_number_c: String(row.build_number_c ?? ''),
      file_size_mb_c: String(row.file_size_mb_c ?? ''),
      package_file_c: fileArray(row.package_file_c)
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId('');
    setForm(EMPTY);
  }

  async function saveRelease(event) {
    event.preventDefault();
    if (profile !== 'Admin_c') return toast.error('Super Admin access is required.');
    if (!form.version_c.trim()) return toast.error('Enter a release version.');
    if (form.release_status_c === 'Published' && !form.store_url_c.trim() && !form.package_url_c.trim() && !form.package_file_c.length) {
      return toast.error('A published release needs a store link, public package URL or uploaded package file.');
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        ...form,
        Name: form.product_c + ' · ' + form.platform_c + ' · ' + form.version_c,
        build_number_c: form.build_number_c === '' ? null : Number(form.build_number_c),
        file_size_mb_c: form.file_size_mb_c === '' ? null : Number(form.file_size_mb_c),
        published_at_c: form.release_status_c === 'Published' ? (form.published_at_c || now) : null
      };
      if (form.is_latest_c) {
        const prior = rows.filter(row => row.product_c === form.product_c && row.platform_c === form.platform_c && row.is_latest_c && row.Id !== editingId);
        for (const row of prior) {
          const unset = await sdk.table('software_releases_c').update({ Id: row.Id, is_latest_c: false });
          if (!unset.data?.length) throw new Error(unset.messages?.[0] || 'Could not unset the previous latest release.');
        }
      }
      const result = editingId
        ? await sdk.table('software_releases_c').update({ Id: editingId, ...payload })
        : await sdk.table('software_releases_c').create(payload);
      if (!result.data?.length) throw new Error(result.messages?.[0] || result.message || 'Release could not be saved.');
      toast.success(form.release_status_c === 'Published' ? 'Release published' : 'Release saved');
      resetForm();
      releases.run();
    } catch (error) {
      toast.error(error.message || 'Release could not be saved');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(row, status) {
    const result = await sdk.table('software_releases_c').update({
      Id: row.Id,
      release_status_c: status,
      published_at_c: status === 'Published' ? (row.published_at_c || new Date().toISOString()) : null
    });
    if (!result.data?.length) return toast.error(result.messages?.[0] || 'Release status was not changed.');
    toast.success('Release ' + status.toLowerCase());
    releases.run();
  }

  async function removeRelease(row) {
    if (!window.confirm('Delete release ' + row.Name + '? This removes its release record, not the stored package file.')) return;
    const result = await sdk.table('software_releases_c').remove(row.Id);
    if (!result.data?.length) return toast.error(result.messages?.[0] || 'Release could not be deleted.');
    toast.success('Release record deleted');
    releases.run();
  }

  if (profile !== 'Admin_c') {
    return <div className="rounded-xl border p-6 text-sm text-muted-foreground">Super Admin access is required to manage software packages.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-2xl bg-primary px-6 py-7 text-primary-foreground">
        <div className="text-xs font-bold uppercase tracking-widest opacity-80">Super Admin · Distribution control</div>
        <h1 className="brand-heading mt-2 text-3xl font-black">Software release manager</h1>
        <p className="mt-2 max-w-3xl text-sm opacity-85">Publish and maintain Android, iOS, Windows, macOS and web releases. Only Published releases appear on the public customer download page.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">{rows.length} release records</Badge>
          <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">{rows.filter(row => row.release_status_c === 'Published').length} published</Badge>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit software release' : 'Add a software release'}</CardTitle>
            <p className="text-sm text-muted-foreground">Upload the package or add an official store / hosted download URL. Never publish a test build as a stable release.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveRelease} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Product module</Label>
                  <Select value={form.product_c} onValueChange={value => setField('product_c', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRODUCTS.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Platform</Label>
                  <Select value={form.platform_c} onValueChange={value => setField('platform_c', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PLATFORMS.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Version *</Label>
                  <Input required value={form.version_c} onChange={event => setField('version_c', event.target.value)} placeholder="1.0.0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Build number</Label>
                  <Input type="number" min="1" value={form.build_number_c} onChange={event => setField('build_number_c', event.target.value)} placeholder="100" />
                </div>
                <div className="space-y-1.5">
                  <Label>Package type</Label>
                  <Select value={form.package_type_c} onValueChange={value => setField('package_type_c', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PACKAGE_TYPES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Minimum OS version</Label>
                  <Input value={form.minimum_os_c} onChange={event => setField('minimum_os_c', event.target.value)} placeholder="Android 10 / Windows 10" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Official store URL</Label>
                <Input type="url" value={form.store_url_c} onChange={event => setField('store_url_c', event.target.value)} placeholder="https://play.google.com/store/apps/details?id=…" />
                <p className="text-xs text-muted-foreground">Use Google Play for Android and Apple App Store for iPhone/iPad when the app is approved and live.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Public package URL (optional)</Label>
                <Input type="url" value={form.package_url_c} onChange={event => setField('package_url_c', event.target.value)} placeholder="https://downloads.yourdomain.com/installer.exe" />
              </div>
              <div className="space-y-1.5">
                <Label>Upload installer / package</Label>
                <FilePicker
                  value={fileArray(form.package_file_c)}
                  onChange={value => setField('package_file_c', value)}
                  maxFiles={1}
                  fieldConfig={{ supportedExtensions: 'apk,aab,exe,msi,dmg,pkg,zip', supportMultipleValues: false, maxValue: 204800 }}
                />
                <p className="text-xs text-muted-foreground">Uploaded packages are stored in application file storage. For public delivery, verify that customer download permissions and signed-link behaviour work before publishing.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Release notes</Label>
                <Textarea rows={4} value={form.release_notes_c} onChange={event => setField('release_notes_c', event.target.value)} placeholder="What changed in this release?" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>SHA-256 checksum</Label>
                  <Input value={form.checksum_sha256_c} onChange={event => setField('checksum_sha256_c', event.target.value)} placeholder="Optional package integrity hash" />
                </div>
                <div className="space-y-1.5">
                  <Label>File size (MB)</Label>
                  <Input type="number" min="0" step="0.01" value={form.file_size_mb_c} onChange={event => setField('file_size_mb_c', event.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Release status</Label>
                <Select value={form.release_status_c} onValueChange={value => setField('release_status_c', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft · hidden from customers</SelectItem>
                    <SelectItem value="Published">Published · visible to customers</SelectItem>
                    <SelectItem value="Deprecated">Deprecated · retired release</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-5 rounded-lg border p-3">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(form.is_latest_c)} onCheckedChange={value => setField('is_latest_c', Boolean(value))} /> Latest release for this platform</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(form.is_mandatory_c)} onCheckedChange={value => setField('is_mandatory_c', Boolean(value))} /> Mandatory update</label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving release…' : form.release_status_c === 'Published' ? 'Save and publish release' : 'Save release draft'}</Button>
                {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel edit</Button>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><CardTitle>Release catalogue</CardTitle><p className="mt-1 text-sm text-muted-foreground">Manage current and previous versions across platforms.</p></div>
              <Button size="sm" variant="outline" onClick={releases.run}>Refresh</Button>
            </div>
            <div className="pt-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="All">All products</SelectItem>{PRODUCTS.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {releases.loading ? <p className="py-8 text-sm text-muted-foreground">Loading release records…</p>
            : releases.error ? <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{releases.error.message} <Button variant="outline" size="sm" onClick={releases.run}>Retry</Button></div>
            : visible.length ? visible.map(row => (
              <div key={row.Id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold">{row.product_c} · {row.platform_c}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Version {row.version_c} · Build {row.build_number_c || '—'} · {row.package_type_c}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant={row.release_status_c === 'Published' ? 'default' : 'secondary'}>{row.release_status_c}</Badge>
                      {row.is_latest_c && <Badge variant="outline">Latest</Badge>}
                      {row.is_mandatory_c && <Badge variant="destructive">Mandatory</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => editRelease(row)}>Edit</Button>
                    {row.release_status_c !== 'Published' && <Button size="sm" onClick={() => changeStatus(row, 'Published')}>Publish</Button>}
                    {row.release_status_c === 'Published' && <Button size="sm" variant="outline" onClick={() => changeStatus(row, 'Deprecated')}>Retire</Button>}
                    <Button size="sm" variant="ghost" onClick={() => removeRelease(row)}><ApperIcon name="Trash2" size={15} /></Button>
                  </div>
                </div>
                {(row.store_url_c || row.package_url_c || fileArray(row.package_file_c).length > 0) && <p className="mt-3 break-all text-xs text-muted-foreground">Distribution target configured</p>}
              </div>
            ))
            : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No release records yet. Add a package to make it available in the customer download centre.</div>}
          </CardContent>
        </Card>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Publishing metadata does not publish an app to Google Play or Apple App Store. Those stores must approve the app first. Never publish a customer-facing installer until signing, malware scanning, release verification, update testing and access control have been completed.</p>
    </div>
  );
}
