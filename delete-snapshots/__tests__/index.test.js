import { jest, describe, test, expect } from '@jest/globals';
import { listPackages, listPackageVersions, deletePackageVersion, selectVersionsToDelete, processPackage } from '../src/index.js';

describe('GitHub Packages API helpers', () => {
  test('listPackages should paginate until no more data', async () => {
    const octokit = { request: jest.fn() };
    // simulate two pages: first with 100 entries, second empty
    const page1 = Array(100).fill('p1');
    octokit.request
      .mockResolvedValueOnce({ data: page1 })
      .mockResolvedValueOnce({ data: [] });

    const result = await listPackages(octokit, 'npm', 'users', 'me');
    expect(octokit.request).toHaveBeenCalledTimes(2);
    expect(octokit.request).toHaveBeenCalledWith('GET /users/{owner}/packages', expect.objectContaining({ package_type: 'npm', owner: 'me' }));
    expect(result).toEqual(page1);
  });

  test('listPackageVersions should collect all pages', async () => {
    const octokit = { request: jest.fn() };
    // simulate two pages: first full 100 items, second partial (<100 stops loop)
    const page1 = Array.from({ length: 100 }, (_, i) => i + 1);
    const page2 = [101, 102];
    octokit.request
      .mockResolvedValueOnce({ data: page1 })
      .mockResolvedValueOnce({ data: page2 });

    const versions = await listPackageVersions(octokit, 'npm', 'mypkg', 'orgs', 'org1');
    expect(octokit.request).toHaveBeenCalledTimes(2);
    expect(octokit.request).toHaveBeenCalledWith(
      'GET /orgs/{owner}/packages/{package_type}/{package_name}/versions',
      expect.objectContaining({ owner: 'org1', package_type: 'npm', package_name: 'mypkg' })
    );
    expect(versions).toEqual([...page1, ...page2]);
  });

  test('deletePackageVersion should forward parameters correctly', async () => {
    const octokit = { request: jest.fn().mockResolvedValue({ status: 204 }) };
    const res = await deletePackageVersion(octokit, 'npm', 'pkg', 123, 'users', 'me');
    expect(octokit.request).toHaveBeenCalledWith(
      'DELETE /users/{owner}/packages/{package_type}/{package_name}/versions/{version_id}',
      expect.objectContaining({ owner: 'me', package_type: 'npm', package_name: 'pkg', version_id: 123 })
    );
    expect(res).toEqual({ status: 204 });
  });

  describe('selectVersionsToDelete', () => {
    const makeVersion = (name, created) => ({ name, created_at: created });

    test('keeps newest versions based on created_at', () => {
      const versions = [
        makeVersion('1.0.0', '2023-01-01'),
        makeVersion('1.0.1', '2023-02-01'),
        makeVersion('1.0.2', '2023-03-01')
      ];
      const toDelete = selectVersionsToDelete(versions, null, 1);
      const names = toDelete.map(v => v.name);
      // should include the two older versions regardless of order
      expect(names).toEqual(expect.arrayContaining(['1.0.0', '1.0.1']));
      expect(names.length).toBe(2);
    });

    test('respects alwaysKeepRegex', () => {
      const versions = [
        makeVersion('keep-me', '2023-01-01'),
        makeVersion('delete-me', '2023-02-01'),
        makeVersion('also-delete', '2023-03-01')
      ];
      const toDelete = selectVersionsToDelete(versions, '^keep', 0);
      const names = toDelete.map(v => v.name);
      expect(names).toEqual(expect.arrayContaining(['delete-me', 'also-delete']));
      expect(names.length).toBe(2);
    });

    test('throws on invalid regex', () => {
      const versions = [makeVersion('x', '2023-01-01')];
      expect(() => selectVersionsToDelete(versions, '[a-', 0)).toThrow(/invalid regex/);
    });
  });

  describe('processPackage', () => {
    const fakeOctokit = {
      request: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('ignores packages not matching repo', async () => {
      const pkg = { repository: { full_name: 'other/repo' } };
      await processPackage(fakeOctokit, pkg, 'owner/repo', 'npm', 1, null, false, 'users', 'owner');
      expect(fakeOctokit.request).not.toHaveBeenCalled();
    });

    test('deletes only selected versions when not dry-run', async () => {
      const pkg = { repository: { full_name: 'owner/repo' }, name: 'mypkg', id: 1 };
      const versions = [
        { name: 'a', created_at: '2023-01-01', id: 10 },
        { name: 'b', created_at: '2023-02-01', id: 11 }
      ];
      fakeOctokit.request
        .mockResolvedValueOnce({ data: versions }) // versions list
        .mockResolvedValue({}); // delete calls

      await processPackage(fakeOctokit, pkg, 'owner/repo', 'npm', 1, null, false, 'users', 'owner');
      expect(fakeOctokit.request).toHaveBeenCalledWith(
        'GET /users/{owner}/packages/{package_type}/{package_name}/versions',
        expect.objectContaining({ owner: 'owner', package_name: 'mypkg' })
      );
      expect(fakeOctokit.request).toHaveBeenCalledWith(
        'DELETE /users/{owner}/packages/{package_type}/{package_name}/versions/{version_id}',
        expect.any(Object)
      );
    });

    test('does not delete when dry-run', async () => {
      const pkg = { repository: { full_name: 'owner/repo' }, name: 'mypkg', id: 1 };
      fakeOctokit.request.mockResolvedValueOnce({ data: [] });
      await processPackage(fakeOctokit, pkg, 'owner/repo', 'npm', 1, null, true, 'users', 'owner');
      // only list call
      expect(fakeOctokit.request).toHaveBeenCalledTimes(1);
    });
  });
});